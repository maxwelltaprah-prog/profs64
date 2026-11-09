import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";

import { FREE_WINDOW_EVENT, FREE_WINDOW_MS, freeWindow } from "@/lib/agent/free-window";
import { AGENT_PROMPT } from "@/lib/agent/prompt";
import { compactAgentParts, createAgentTools } from "@/lib/agent/tools";
import { tryAcquire } from "@/lib/ai/concurrency";
import { aiDisabled, dailyCreditCap, HISTORY_MESSAGES, REQUEST_TIMEOUT_MS } from "@/lib/ai/config";
import { characterCount, sanitizeParts, toUiMessages, usagePart } from "@/lib/ai/messages";
import { chooseFreeModel, chooseModel } from "@/lib/ai/model-factory";
import { DEFAULT_MODEL, FREE_MODELS } from "@/lib/ai/models";
import { watchForStop } from "@/lib/ai/stop-watch";
import { providerStatus, streamErrorText } from "@/lib/ai/stream-errors";
import { createBiller } from "@/lib/credits/billing";
import { MIN_BALANCE_TO_START } from "@/lib/credits/math";
import { getVerifiedUser } from "@/lib/db/auth";
import {
  getConversation,
  latestFreeWindowStart,
  listConversationMessages,
} from "@/lib/db/conversations";
import { getCreditBalance, translateDbError } from "@/lib/db/projects";
import {
  creditsSpentToday,
  deductCredits,
  insertConversationAssistantMessage,
  insertConversationDocument,
  recordAuditEvent,
  touchConversation,
} from "@/lib/db/service";
import { latestStopId, stopRequestedSince } from "@/lib/db/stop";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { getClientIp, hashForKey } from "@/lib/security/client-ip";
import { aiUnavailable, AppError, chatBusy } from "@/lib/security/errors";
import { logger } from "@/lib/security/logger";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { agentChatBodySchema, CHAT_BODY_LIMIT_BYTES } from "@/lib/security/schemas";

export const maxDuration = 150;

const MAX_AGENT_STEPS = 4;

const freeUsed = (availableAt: Date) =>
  new AppError(
    402,
    "free_window_used",
    `You are out of credits and have used your 24 free hours. Free access is available again from ${availableAt.toUTCString()}.`,
  );

// The general chat agent: answers questions and creates documents. Paid by credits like the
// builder; when the person's credits for the day run out it switches to a free model for 24 hours
// (lib/agent/free-window.ts), which is never billed.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("agent.chat", async (_request, { requestId }) => {
    const user = await getVerifiedUser();
    if (aiDisabled()) throw aiUnavailable();
    const body = await readJson(request, agentChatBodySchema, CHAT_BODY_LIMIT_BYTES);
    await enforceLimits([
      { config: LIMITS.agentUser, key: user.id },
      { config: LIMITS.agentIp, key: hashForKey(getClientIp(request.headers)) },
    ]);

    const supabase = await createSupabaseServerClient();
    await getConversation(id, supabase);

    // One live reply per person. The lease is taken before any billing decision, so a request that
    // is rejected as busy can never start or extend the free window it would not go on to serve.
    const lease = tryAcquire(user.id);
    if (!lease) throw chatBusy();
    const release: () => void = lease;

    let freeUntil: Date | null = null;
    try {
      // Paid while credits remain for today; otherwise the free window, if it is open or can open.
      const balance = await getCreditBalance(user.id, supabase);
      const outOfCredits =
        balance < MIN_BALANCE_TO_START || (await creditsSpentToday(user.id)) >= dailyCreditCap();
      if (outOfCredits) {
        const window = freeWindow(await latestFreeWindowStart(supabase), new Date());
        if (window.state === "cooling-down") throw freeUsed(window.availableAt);
        await enforceLimits([{ config: LIMITS.agentFreeUser, key: user.id }]);
        if (window.state === "available") {
          await recordAuditEvent({
            userId: user.id,
            event: FREE_WINDOW_EVENT,
            metadata: {},
            requestId,
          });
          freeUntil = new Date(Date.now() + FREE_WINDOW_MS);
        } else {
          freeUntil = window.until;
        }
      }
      return await start();
    } catch (error) {
      release();
      throw error;
    }

    async function start(): Promise<Response> {
      const text = body.message.parts[0]?.text ?? "";
      const { error: insertError } = await supabase
        .from("conversation_messages")
        .insert({ conversation_id: id, role: "user", parts: [{ type: "text", text }] });
      if (insertError) throw translateDbError(insertError);

      const history = toUiMessages(await listConversationMessages(id, supabase), HISTORY_MESSAGES);
      const tools = createAgentTools({
        save: (document) => insertConversationDocument({ conversationId: id, ...document }),
      });
      const free = freeUntil !== null;
      const chosen = free ? chooseFreeModel() : chooseModel();
      const biller = free
        ? null
        : createBiller({
            userId: user.id,
            projectId: null,
            requestId,
            inputChars: AGENT_PROMPT.length + characterCount(history),
            getModelId: chosen.usedModelId,
            deduct: deductCredits,
          });

      const stopper = new AbortController();
      const baseline = await latestStopId(id, supabase, "conversationId");
      const unwatch = watchForStop(
        () => stopRequestedSince(id, baseline, supabase, "conversationId"),
        () => stopper.abort(),
      );

      const result = streamText({
        model: chosen.model,
        instructions: AGENT_PROMPT,
        messages: await convertToModelMessages(history, { ignoreIncompleteToolCalls: true }),
        tools,
        stopWhen: isStepCount(MAX_AGENT_STEPS),
        maxOutputTokens: free
          ? (FREE_MODELS[0]?.maxOutputTokens ?? 4000)
          : DEFAULT_MODEL.maxOutputTokens,
        abortSignal: AbortSignal.any([request.signal, stopper.signal]),
        timeout: { totalMs: REQUEST_TIMEOUT_MS },
        onStepStart: () => biller?.stepStarted(),
        onChunk: ({ chunk }) => {
          if (chunk.type === "text-delta") biller?.textSeen(chunk.text.length);
          else if (
            chunk.type === "tool-call" ||
            chunk.type === "tool-input-start" ||
            chunk.type === "reasoning-delta"
          )
            biller?.activitySeen();
        },
        onStepEnd: (step) => biller?.stepEnded(step.usage),
        onEnd: async (event) => {
          await biller?.settle("finish", event.totalUsage);
        },
        onAbort: async () => {
          await biller?.settle("abort");
        },
        onError: ({ error }) => {
          logger.error("model_stream_error", {
            requestId,
            route: "agent",
            free,
            errorName: error instanceof Error ? error.name : "unknown",
            providerStatus: providerStatus(error) ?? null,
          });
        },
      });

      const assistantId = crypto.randomUUID();
      const stream = toUIMessageStream({
        stream: result.stream,
        originalMessages: history,
        generateMessageId: () => assistantId,
        tools,
        onError: (error) => streamErrorText(error),
        onEnd: async ({ messages, isAborted, isCancelled, outcome }) => {
          try {
            const charged = await biller?.settle(
              isAborted || isCancelled || outcome.status === "aborted"
                ? "abort"
                : outcome.status === "failed"
                  ? "error"
                  : "finish",
            );
            const response = messages[messages.length - 1];
            if (response?.role !== "assistant") return;
            const parts = compactAgentParts(sanitizeParts(response.parts));
            if (parts.length === 0) return;
            if (charged) parts.push(usagePart(charged));
            if (free) parts.push({ type: "data-free", data: { model: chosen.usedModelId() } });
            try {
              await insertConversationAssistantMessage({
                id: assistantId,
                conversationId: id,
                parts,
              });
              await touchConversation(id);
            } catch (error) {
              logger.error("assistant_message_write_failed", { requestId, error });
            }
          } finally {
            unwatch();
            release();
          }
        },
      });

      // A browser that goes away cancels the response; that settles billing too (once).
      const reader = stream.getReader();
      const guarded = new ReadableStream<
        Awaited<ReturnType<typeof reader.read>> extends { value?: infer V } ? V : never
      >({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) controller.close();
          else controller.enqueue(value as never);
        },
        async cancel(reason) {
          try {
            await biller?.settle("cancel");
          } finally {
            unwatch();
            release();
          }
          await reader.cancel(reason);
        },
      });

      return createUIMessageStreamResponse({
        stream: guarded as typeof stream,
        headers: free
          ? { "x-buildr-mode": "free", "x-buildr-free-until": (freeUntil as Date).toISOString() }
          : { "x-buildr-mode": "paid" },
      });
    }
  })(request);
}
