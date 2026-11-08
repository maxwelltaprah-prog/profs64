import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";

import { tryAcquire } from "@/lib/ai/concurrency";
import {
  aiDisabled,
  dailyCreditCap,
  HISTORY_MESSAGES,
  MAX_STEPS,
  REQUEST_TIMEOUT_MS,
  SNAPSHOT_BYTES,
} from "@/lib/ai/config";
import { buildSnapshot } from "@/lib/ai/context";
import { characterCount, sanitizeParts, toUiMessages, usagePart } from "@/lib/ai/messages";
import { chooseModel } from "@/lib/ai/model-factory";
import { DEFAULT_MODEL } from "@/lib/ai/models";
import { watchForStop } from "@/lib/ai/stop-watch";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { createProjectTools } from "@/lib/ai/tools";
import { createBiller } from "@/lib/credits/billing";
import { MIN_BALANCE_TO_START } from "@/lib/credits/math";
import { getVerifiedUser } from "@/lib/db/auth";
import { createDbFileStore } from "@/lib/db/files";
import {
  getCreditBalance,
  getProject,
  listMessages,
  listProjectFiles,
  translateDbError,
} from "@/lib/db/projects";
import { creditsSpentToday, deductCredits, insertAssistantMessage } from "@/lib/db/service";
import { latestStopId, stopRequestedSince } from "@/lib/db/stop";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { getClientIp, hashForKey } from "@/lib/security/client-ip";
import {
  aiUnavailable,
  chatBusy,
  dailyLimitReached,
  insufficientCredits,
} from "@/lib/security/errors";
import { logger } from "@/lib/security/logger";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { CHAT_BODY_LIMIT_BYTES, chatBodySchema } from "@/lib/security/schemas";

// Allow the longest request (REQUEST_TIMEOUT_MS) plus time to settle billing.
export const maxDuration = 150;

export const POST = withApi("chat", async (request, { requestId }) => {
  const user = await getVerifiedUser();
  if (aiDisabled()) throw aiUnavailable();

  const body = await readJson(request, chatBodySchema, CHAT_BODY_LIMIT_BYTES);

  await enforceLimits([
    { config: LIMITS.chatUser, key: user.id },
    { config: LIMITS.chatIp, key: hashForKey(getClientIp(request.headers)) },
  ]);

  const projectId = body.id;
  const supabase = await createSupabaseServerClient();
  // Ownership: RLS returns nothing for someone else's project, which surfaces as a 404.
  await getProject(projectId, supabase);

  // Everything below this gate is the only code that can reach the model, and the gate runs first.
  const balance = await getCreditBalance(user.id, supabase);
  if (balance < MIN_BALANCE_TO_START) throw insufficientCredits();
  if ((await creditsSpentToday(user.id)) >= dailyCreditCap()) throw dailyLimitReached();

  const lease = tryAcquire(user.id);
  if (!lease) throw chatBusy();
  const release: () => void = lease;

  try {
    return await startChat();
  } catch (error) {
    release();
    throw error;
  }

  async function startChat(): Promise<Response> {
    const text = body.message.parts[0]?.text ?? "";
    const { error: insertError } = await supabase
      .from("messages")
      .insert({ project_id: projectId, role: "user", parts: [{ type: "text", text }] });
    if (insertError) throw translateDbError(insertError);

    const [files, stored] = await Promise.all([
      listProjectFiles(projectId, supabase),
      listMessages(projectId, supabase),
    ]);
    const history = toUiMessages(stored, HISTORY_MESSAGES);
    const snapshot = buildSnapshot(files, SNAPSHOT_BYTES);
    const tools = createProjectTools(createDbFileStore(supabase, projectId));

    const modelMessages = [
      { role: "user" as const, content: snapshot.text },
      ...(await convertToModelMessages(history, { ignoreIncompleteToolCalls: true })),
    ];

    const chosen = chooseModel();
    const biller = createBiller({
      userId: user.id,
      projectId,
      requestId,
      inputChars: snapshot.chars + SYSTEM_PROMPT.length + characterCount(history),
      getModelId: chosen.usedModelId,
      deduct: deductCredits,
    });

    // Stop from the browser: the Stop button records an event (see lib/db/stop.ts) that this
    // request notices, because on Vercel a disconnect alone does not cancel the model call.
    const stopper = new AbortController();
    const baseline = await latestStopId(projectId, supabase);
    const unwatch = watchForStop(
      () => stopRequestedSince(projectId, baseline, supabase),
      () => stopper.abort(),
    );

    const result = streamText({
      model: chosen.model,
      instructions: SYSTEM_PROMPT,
      messages: modelMessages,
      tools,
      stopWhen: isStepCount(MAX_STEPS),
      maxOutputTokens: DEFAULT_MODEL.maxOutputTokens,
      abortSignal: AbortSignal.any([request.signal, stopper.signal]),
      timeout: { totalMs: REQUEST_TIMEOUT_MS },
      onStepStart: () => biller.stepStarted(),
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") biller.textSeen(chunk.text.length);
        else if (
          chunk.type === "tool-call" ||
          chunk.type === "tool-input-start" ||
          chunk.type === "reasoning-delta"
        ) {
          biller.activitySeen();
        }
      },
      onStepEnd: (step) => biller.stepEnded(step.usage),
      onEnd: async (event) => {
        await biller.settle("finish", event.totalUsage);
      },
      onAbort: async () => {
        await biller.settle("abort");
      },
      onError: ({ error }) => {
        // Logged without the message text: provider errors can echo prompt content.
        logger.error("model_stream_error", {
          requestId,
          errorName: error instanceof Error ? error.name : "unknown",
        });
      },
    });

    // The reply's id is fixed up front so the live message in the browser and the stored row are
    // the same message: feedback and the credits used attach to it by this id.
    const assistantId = crypto.randomUUID();

    const stream = toUIMessageStream({
      stream: result.stream,
      originalMessages: history,
      generateMessageId: () => assistantId,
      tools,
      // Provider errors are replaced with a fixed message; raw error text is never sent to the browser.
      onError: () =>
        "The assistant ran into a problem. Your credits were charged only for what was used. Try again.",
      onEnd: async ({ messages, isAborted, isCancelled, outcome }) => {
        // Billing first and unconditionally: whatever ended the stream, settle() runs once.
        try {
          const charged = await biller.settle(
            isAborted || isCancelled || outcome.status === "aborted"
              ? "abort"
              : outcome.status === "failed"
                ? "error"
                : "finish",
          );

          const response = messages[messages.length - 1];
          if (response?.role !== "assistant") return;
          const parts = sanitizeParts(response.parts);
          if (parts.length === 0) return;
          // What this reply cost is stored with it, so each output can show its own credits.
          if (charged) parts.push(usagePart(charged));
          try {
            await insertAssistantMessage({ id: assistantId, projectId, parts });
          } catch (error) {
            logger.error("assistant_message_write_failed", { requestId, error });
          }
        } finally {
          unwatch();
          release();
        }
      },
    });

    // If the browser goes away and cancels the response, the SDK callbacks may never fire, so the
    // cancel itself settles billing. settle() runs once, so this cannot double charge.
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
          await biller.settle("cancel");
        } finally {
          unwatch();
          release();
        }
        await reader.cancel(reason);
      },
    });

    return createUIMessageStreamResponse({ stream: guarded as typeof stream });
  }
});
