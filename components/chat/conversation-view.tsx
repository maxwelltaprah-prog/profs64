"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircle, ImageIcon, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentComposer } from "@/components/chat/agent-composer";
import { DocumentCard } from "@/components/chat/document-card";
import { iconProps } from "@/components/ui/icons";
import { MessageText } from "@/components/workspace/message-text";
import { OutputBar } from "@/components/workspace/output-bar";
import { cn } from "@/lib/utils/cn";
import {
  documentStep,
  firstMessageKey,
  replyCredits,
  replyIsFree,
  replyText,
  visibleDocumentSteps,
} from "@/lib/workspace/agent";
import {
  MAX_IMAGES_PER_MESSAGE,
  quickImageCheck,
  uploadChatImage,
  splitImageMarker,
  withImageMarker,
  type ChatImage,
} from "@/lib/workspace/chat-images";
import { friendlyChatError } from "@/lib/workspace/chat-lines";
import { creditsLabel, type Rating } from "@/lib/workspace/outputs";

const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
  weekday: "short",
});

function AssistantReply({
  message,
  conversationId,
  streaming,
  rating,
  onRate,
  onRegenerate,
}: {
  message: UIMessage;
  conversationId: string;
  streaming: boolean;
  rating: Rating | null;
  onRate: (rating: Rating | null) => void;
  /** Given only for the newest reply when a new one can be requested. */
  onRegenerate?: (() => void) | undefined;
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
          {text ? (
            <OutputBar
              bare
              text={text}
              info={{ usage: null, rating }}
              onRate={onRate}
              onRegenerate={onRegenerate}
            />
          ) : null}
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
  initialRatings = {},
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  /** Set when the person is out of credits and the 24-hour free window is open. */
  initialFreeUntil: string | null;
  /** The person's thumbs up or down per reply, by message id. */
  initialRatings?: Record<string, Rating>;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [freeUntil, setFreeUntil] = useState<string | null>(initialFreeUntil);
  const [ratings, setRatings] = useState<Record<string, Rating | null>>(initialRatings);
  const log = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/conversations/${conversationId}/chat`,
        // Only the newest message is sent; the server loads the rest of the conversation itself.
        prepareSendMessagesRequest: ({ messages, trigger }) => {
          // For a regenerate the newest message is the user message the reply answered.
          const last = messages[messages.length - 1];
          const text = (last?.parts ?? [])
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
          return {
            body: {
              message: { role: "user", parts: [{ type: "text", text }] },
              ...(trigger === "regenerate-message" ? { regenerate: true } : {}),
            },
          };
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

  const { messages, sendMessage, regenerate, status, stop } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onError: (chatError) => setError(friendlyChatError(chatError)),
  });
  const busy = status === "submitted" || status === "streaming";

  const rate = async (messageId: string, next: Rating | null) => {
    const previous = ratings[messageId] ?? null;
    setRatings((current) => ({ ...current, [messageId]: next }));
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages/${messageId}/feedback`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rating: next ?? "none" }),
        },
      );
      if (!response.ok) throw new Error("rating failed");
    } catch {
      setRatings((current) => ({ ...current, [messageId]: previous }));
      setError("Your rating could not be saved. Try again.");
    }
  };

  const [images, setImages] = useState<ChatImage[]>([]);
  const attach = async (picked: File[]) => {
    const problem = picked.map(quickImageCheck).find((message) => message !== null);
    if (problem) return setError(problem);
    setError(null);
    for (const file of picked.slice(0, Math.max(0, MAX_IMAGES_PER_MESSAGE - images.length))) {
      try {
        const image = await uploadChatImage(conversationId, file);
        setImages((current) => [...current, image].slice(0, MAX_IMAGES_PER_MESSAGE));
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Could not attach that.");
        return;
      }
    }
  };

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
                <UserBubble text={replyText(message.parts as unknown[])} />
              </div>
            ) : (
              <AssistantReply
                key={message.id}
                message={message}
                conversationId={conversationId}
                streaming={busy && index === messages.length - 1}
                rating={ratings[message.id] ?? null}
                onRate={(next) => void rate(message.id, next)}
                onRegenerate={
                  index === messages.length - 1 && !busy
                    ? () => {
                        setError(null);
                        void regenerate();
                      }
                    : undefined
                }
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
          attachments={images.map((image) => ({ key: image.id, name: image.name }))}
          onAttach={(picked) => void attach(picked)}
          onRemoveAttachment={(key) => setImages((current) => current.filter((i) => i.id !== key))}
          onSend={() => {
            const text = input.trim();
            if (!text) return;
            setInput("");
            const attached = images;
            setImages([]);
            send(withImageMarker(text, attached));
          }}
        />
      </div>
    </div>
  );
}

// A person's message. The picture marker the assistant reads is shown as named chips instead.
function UserBubble({ text }: { text: string }) {
  const shown = splitImageMarker(text);
  return (
    <div className="bg-surface-2 max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-6 [overflow-wrap:anywhere]">
      <p className="whitespace-pre-wrap">{shown.text}</p>
      {shown.names.length > 0 ? (
        <ul aria-label="Attached pictures" className="mt-2 flex flex-wrap gap-1.5">
          {shown.names.map((name, i) => (
            <li
              key={`${i}-${name}`}
              className="border-hairline bg-surface flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              <ImageIcon size={12} aria-hidden="true" />
              <span className="truncate">{name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
