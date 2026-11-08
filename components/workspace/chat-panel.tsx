"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircle, ArrowDown, Check, Loader, Send, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { MessageText } from "@/components/workspace/message-text";
import { cn } from "@/lib/utils/cn";
import {
  changedFiles,
  describeToolPart,
  friendlyChatError,
  type ToolLine,
} from "@/lib/workspace/chat-lines";
import { clearPendingPrompt, readPendingPrompt } from "@/lib/workspace/pending-prompt";

const MAX_CHARS = 8000;

type Part = UIMessage["parts"][number];

const SUGGESTIONS = [
  "A landing page for a coffee shop with a menu and opening hours",
  "A habit tracker with a weekly grid and streak counter",
  "An expense log with a monthly total",
] as const;

// Consecutive file steps are shown together as one list, so a burst of tool calls reads as one
// piece of work instead of a stack of loose lines.
function groupParts(
  parts: Part[],
): Array<
  | { kind: "text"; index: number; part: Part }
  | { kind: "steps"; lines: Array<{ index: number; line: ToolLine }> }
> {
  const out: ReturnType<typeof groupParts> = [];
  parts.forEach((part, index) => {
    if (part.type === "text") {
      if (part.text) out.push({ kind: "text", index, part });
      return;
    }
    const line = describeToolPart(part as Parameters<typeof describeToolPart>[0]);
    if (!line) return;
    const previous = out[out.length - 1];
    if (previous?.kind === "steps") previous.lines.push({ index, line });
    else out.push({ kind: "steps", lines: [{ index, line }] });
  });
  return out;
}

function MessageBody({
  message,
  live,
  animate,
}: {
  message: UIMessage;
  live: boolean;
  animate: boolean;
}) {
  const lastIndex = message.parts.length - 1;

  if (message.role === "user") {
    const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
    return (
      <div className="bg-surface-2 ml-auto max-w-[88%] rounded-2xl rounded-br-md px-3.5 py-2.5 [overflow-wrap:anywhere] whitespace-pre-wrap">
        {text}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {groupParts(message.parts).map((group) =>
        group.kind === "text" ? (
          <MessageText
            key={group.index}
            text={group.part.type === "text" ? group.part.text : ""}
            streaming={live && group.index === lastIndex}
            animate={animate}
          />
        ) : (
          <ul
            key={`steps-${group.lines[0]?.index}`}
            aria-label="File changes"
            className={cn(
              "ring-line bg-surface divide-hairline divide-y overflow-hidden rounded-lg",
              animate && "chat-in",
            )}
          >
            {group.lines.map(({ index, line }) => (
              <ToolLineRow key={index} line={line} animate={animate} />
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function ToolLineRow({ line, animate }: { line: ToolLine; animate: boolean }) {
  const Icon = line.state === "working" ? Loader : line.state === "failed" ? AlertCircle : Check;
  return (
    <li
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 font-mono text-xs leading-5",
        line.state === "failed" ? "text-danger" : "text-muted",
        animate && "chat-in",
      )}
    >
      <Icon
        {...iconProps}
        className={cn(
          "mt-0.5 shrink-0",
          line.state === "working" && "text-accent motion-safe:animate-spin",
          line.state === "done" && "text-success",
        )}
      />
      <span className="min-w-0 [overflow-wrap:anywhere]">{line.text}</span>
    </li>
  );
}

function Thinking() {
  return (
    <li className="text-muted flex items-center gap-2 text-xs" role="status">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </span>
      Working
    </li>
  );
}

export function ChatPanel({
  projectId,
  initialMessages,
  canUseAssistant,
  hasCredits,
  onFilesChanged,
  onFinished,
}: {
  projectId: string;
  initialMessages: UIMessage[];
  canUseAssistant: boolean;
  hasCredits: boolean;
  onFilesChanged: () => void;
  onFinished: () => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);
  const input_ = useRef<HTMLTextAreaElement>(null);
  // Only what arrives after the panel opened animates; the history that was already there
  // does not replay.
  const [knownMessages] = useState(initialMessages.length);
  const notifiedTools = useRef(new Set<string>());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Only the newest message goes to the server; history is loaded there from the database.
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          const text = (last?.parts ?? [])
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
          return {
            body: { id: projectId, message: { role: "user", parts: [{ type: "text", text }] } },
          };
        },
      }),
    [projectId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: projectId,
    messages: initialMessages,
    transport,
    onError: (chatError) => setError(friendlyChatError(chatError)),
    onFinish: () => onFinished(),
  });

  const busy = status === "submitted" || status === "streaming";
  const enabled = canUseAssistant && hasCredits;

  // Show the dots whenever work is under way but no text is streaming and no file step is
  // running: between sending and the first token, and between one tool call and the next.
  const lastMessage = messages[messages.length - 1];
  const lastPart = lastMessage?.parts[lastMessage.parts.length - 1];
  const lastLine =
    lastPart && lastPart.type.startsWith("tool-")
      ? describeToolPart(lastPart as Parameters<typeof describeToolPart>[0])
      : null;
  const thinking =
    status === "submitted" ||
    (status === "streaming" &&
      lastMessage?.role === "assistant" &&
      !(lastPart?.type === "text" && lastPart.text !== "") &&
      lastLine?.state !== "working");

  // A prompt typed on the home page before signing in is sent once, only into the project it
  // was saved for, and only when the assistant can actually run. Otherwise it stays in the box
  // so the person can send it themselves once they have confirmed their email or topped up.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current) return;
    const pending = readPendingPrompt();
    if (!pending || pending.projectId !== projectId) return;
    autoSent.current = true;
    clearPendingPrompt();
    if (enabled && initialMessages.length === 0) {
      stick.current = true;
      void sendMessage({ text: pending.text });
    } else {
      // Client-only state: the prompt lives in localStorage, so it cannot be an initial value
      // without a hydration mismatch. One extra render on mount is the cost.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput(pending.text);
    }
  }, [enabled, initialMessages.length, projectId, sendMessage]);

  // Refresh the file tree as soon as each file-changing tool call completes.
  useEffect(() => {
    let changed = false;
    for (const message of messages) {
      for (const part of message.parts) {
        if (!part.type.startsWith("tool-")) continue;
        const id = `${message.id}:${(part as { toolCallId?: string }).toolCallId ?? ""}`;
        if (
          changedFiles(part as Parameters<typeof changedFiles>[0]) &&
          !notifiedTools.current.has(id)
        ) {
          notifiedTools.current.add(id);
          changed = true;
        }
      }
    }
    if (changed) onFilesChanged();
  }, [messages, onFilesChanged]);

  useEffect(() => {
    const element = log.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [messages, status]);

  const jumpToLatest = () => {
    const element = log.current;
    if (!element) return;
    stick.current = true;
    setAway(false);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy || !enabled) return;
    setError(null);
    setInput("");
    stick.current = true;
    void sendMessage({ text });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  const placeholder = !canUseAssistant
    ? "Confirm your email address to use the assistant"
    : !hasCredits
      ? "You are out of credits"
      : "Describe what to build";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={log}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          onScroll={(event) => {
            const el = event.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            stick.current = atBottom;
            setAway((current) => (current === !atBottom ? current : !atBottom));
          }}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5"
        >
          {messages.length === 0 ? (
            <div className="chat-in flex flex-col gap-4 text-[13px]">
              <div>
                <p className="text-text text-sm font-medium">What should we build?</p>
                <p className="text-muted mt-1 leading-5">
                  Describe it in plain words. The assistant creates and edits the files in this
                  project, and the preview updates as it works.
                </p>
              </div>
              {enabled ? (
                <ul className="flex flex-col gap-2" aria-label="Starting points">
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => {
                          setInput(suggestion);
                          input_.current?.focus();
                        }}
                        className="press ring-line bg-surface text-muted hover:text-text hover:bg-surface-2 w-full rounded-lg px-3 py-2 text-left leading-5"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <ol className="flex flex-col gap-6">
              {messages.map((message, index) => {
                const animate = index >= knownMessages;
                const live = busy && index === messages.length - 1 && message.role === "assistant";
                return (
                  <li
                    key={message.id}
                    className={cn("min-w-0 text-sm leading-6", animate && "chat-in")}
                  >
                    <p
                      className={cn(
                        "text-subtle mb-1.5 text-xs leading-4 font-medium",
                        message.role === "user" && "sr-only",
                      )}
                    >
                      {message.role === "user" ? "You" : "Buildr"}
                    </p>
                    <MessageBody message={message} live={live} animate={animate} />
                  </li>
                );
              })}
              {thinking ? <Thinking /> : null}
            </ol>
          )}
        </div>

        {away ? (
          <button
            type="button"
            onClick={jumpToLatest}
            className="press ring-line bg-surface text-muted hover:text-text chat-in absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full px-3 text-xs shadow-md"
          >
            <ArrowDown {...iconProps} />
            Latest
          </button>
        ) : null}
      </div>

      {!hasCredits && canUseAssistant ? (
        <p
          role="status"
          className="border-hairline bg-accent-subtle border-t px-4 py-2 text-[13px]"
        >
          You are out of credits, so the assistant is paused. Your projects and files are still
          available.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="border-danger bg-danger-subtle border-t px-4 py-2 text-[13px]">
          {error}
        </p>
      ) : null}

      <form onSubmit={submit} className="p-3">
        <div className="border-input bg-surface transition-ui ring-line-focus rounded-xl border">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            ref={input_}
            id="chat-input"
            rows={2}
            maxLength={MAX_CHARS}
            value={input}
            disabled={!enabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="placeholder:text-subtle field-sizing-content max-h-48 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm leading-6 focus-visible:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
            <p className="text-muted text-xs">
              <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> to send
            </p>
            {busy ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void stop()}>
                <Square {...iconProps} />
                Stop
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={!enabled || input.trim().length === 0}>
                <Send {...iconProps} />
                Send
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
