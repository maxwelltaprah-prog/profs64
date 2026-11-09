"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircle, Check, Copy, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentComposer } from "@/components/chat/agent-composer";
import { DocumentCard } from "@/components/chat/document-card";
import { iconProps } from "@/components/ui/icons";
import { MessageText } from "@/components/workspace/message-text";
import { cn } from "@/lib/utils/cn";
import {
  documentStep,
  firstMessageKey,
  replyCredits,
  replyIsFree,
  replyText,
  visibleDocumentSteps,
} from "@/lib/workspace/agent";
import { friendlyChatError } from "@/lib/workspace/chat-lines";
import { creditsLabel } from "@/lib/workspace/outputs";

const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
  weekday: "short",
});

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy reply"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked; the text is still selectable.
        }
      }}
      className="press text-subtle hover:text-text hover:bg-surface-2 inline-flex size-7 items-center justify-center rounded-md"
    >
      {copied ? <Check {...iconProps} /> : <Copy {...iconProps} />}
    </button>
  );
}

function AssistantReply({
  message,
  conversationId,
  streaming,
}: {
  message: UIMessage;
  conversationId: string;
  streaming: boolean;
}) {
  const parts = message.parts as unknown[];
  const credits = replyCredits(parts);
  const free = replyIsFree(parts);
  const text = replyText(parts);
  const shown = visibleDocumentSteps(parts);
  return (
    <div className="chat-in flex flex-col gap-3">
      {parts.map((part, index) => {
        const record = part as { type?: string; text?: string; state?: string };
        if (record.type === "text" && typeof record.text === "string" && record.text.trim()) {
          return (
            <MessageText
              key={index}
              text={record.text}
              streaming={streaming && record.state === "streaming"}
              animate={streaming}
            />
          );
        }
        const step = documentStep(part);
        if (!step || !shown.has(index)) return null;
        if (step.state === "done")
          return (
            <DocumentCard key={index} conversationId={conversationId} document={step.document} />
          );
        if (step.state === "working")
          return (
            <p key={index} className="text-muted flex items-center gap-2 text-[13px]" role="status">
              <span aria-hidden="true" className="flex gap-1">
                <span className="thinking-dot" />
                <span className="thinking-dot" />
                <span className="thinking-dot" />
              </span>
              Creating your document
            </p>
          );
        return (
          <p key={index} className="text-danger flex items-center gap-1.5 text-[13px]">
            <AlertCircle {...iconProps} />
            {step.message}
          </p>
        );
      })}
      {!streaming && (text || credits !== null || free) ? (
        <div className="text-subtle flex items-center gap-2 text-xs">
          {text ? <CopyButton text={text} /> : null}
          {free ? (
            <span className="border-hairline inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
              <Sparkles size={12} strokeWidth={1.75} aria-hidden="true" />
              Free model
            </span>
          ) : credits !== null ? (
            <span className="tabular-nums">{creditsLabel(credits)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ConversationView({
  conversationId,
  initialMessages,
  initialFreeUntil,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  /** Set when the person is out of credits and the 24-hour free window is open. */
  initialFreeUntil: string | null;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [freeUntil, setFreeUntil] = useState<string | null>(initialFreeUntil);
  const log = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/conversations/${conversationId}/chat`,
        // Only the newest message is sent; the server loads the rest of the conversation itself.
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          const text = (last?.parts ?? [])
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
          return { body: { message: { role: "user", parts: [{ type: "text", text }] } } };
        },
        // The server says in a header whether this reply runs on the free model.
        fetch: async (request, init) => {
          const response = await fetch(request, init);
          if (response.headers.get("x-buildr-mode") === "free") {
            setFreeUntil(response.headers.get("x-buildr-free-until"));
          }
          return response;
        },
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onError: (chatError) => setError(friendlyChatError(chatError)),
  });
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    setError(null);
    void sendMessage({ text });
  };

  // The first message, typed on the new-chat screen, is sent once when the conversation opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let first: string | null = null;
    try {
      first = window.sessionStorage.getItem(firstMessageKey(conversationId));
      window.sessionStorage.removeItem(firstMessageKey(conversationId));
    } catch {
      first = null;
    }
    // Sending reads browser storage once after mount, which is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (first && initialMessages.length === 0) send(first);
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the newest content in view while it streams, unless the person scrolled up to read.
  useEffect(() => {
    const element = log.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 160;
    if (nearBottom || status === "submitted") element.scrollTop = element.scrollHeight;
  }, [messages, status]);

  const stopReply = () => {
    void stop();
    void fetch(`/api/conversations/${conversationId}/stop`, { method: "POST" }).catch(
      () => undefined,
    );
  };

  const last = messages[messages.length - 1];
  const waiting = busy && (last?.role === "user" || (last?.parts ?? []).length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={log}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 pt-8 pb-10">
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div key={message.id} className="chat-in flex justify-end">
                <p className="bg-surface-2 max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {replyText(message.parts as unknown[])}
                </p>
              </div>
            ) : (
              <AssistantReply
                key={message.id}
                message={message}
                conversationId={conversationId}
                streaming={busy && index === messages.length - 1}
              />
            ),
          )}
          {waiting ? (
            <p className="text-muted flex items-center gap-2 text-[13px]" role="status">
              <span aria-hidden="true" className="flex gap-1">
                <span className="thinking-dot" />
                <span className="thinking-dot" />
                <span className="thinking-dot" />
              </span>
              Thinking
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="border-danger bg-danger-subtle rounded-lg border px-3 py-2 text-[13px]"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-5">
        {freeUntil ? (
          <p
            className={cn(
              "glass border-hairline mb-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px]",
            )}
          >
            <Sparkles {...iconProps} className="text-accent mt-0.5 shrink-0" />
            <span>
              You are out of credits for today, so replies use a free model until{" "}
              {timeFormat.format(new Date(freeUntil))}. Free replies can be slower and less
              accurate, and they are not charged.
            </span>
          </p>
        ) : null}
        <AgentComposer
          value={input}
          onChange={setInput}
          busy={busy}
          onStop={stopReply}
          onSend={() => {
            const text = input.trim();
            if (!text) return;
            setInput("");
            send(text);
          }}
        />
      </div>
    </div>
  );
}
