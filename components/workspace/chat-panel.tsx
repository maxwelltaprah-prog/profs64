"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircle, Check, FileText, Loader, Send, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils/cn";
import {
  changedFiles,
  describeToolPart,
  friendlyChatError,
  type ToolLine,
} from "@/lib/workspace/chat-lines";
import { clearPendingPrompt, readPendingPrompt } from "@/lib/workspace/pending-prompt";

const MAX_CHARS = 8000;

function MessageBody({ message }: { message: UIMessage }) {
  return (
    <>
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          // Plain text node only: model output is never rendered as HTML.
          return part.text ? (
            <p key={index} className="whitespace-pre-wrap">
              {part.text}
            </p>
          ) : null;
        }
        const line = describeToolPart(part as Parameters<typeof describeToolPart>[0]);
        return line ? <ToolLineRow key={index} line={line} /> : null;
      })}
    </>
  );
}

function ToolLineRow({ line }: { line: ToolLine }) {
  const Icon = line.state === "working" ? Loader : line.state === "failed" ? AlertCircle : Check;
  return (
    <p
      className={cn(
        "my-1 flex items-center gap-2 font-mono text-xs",
        line.state === "failed" ? "text-danger" : "text-muted",
      )}
    >
      <Icon
        {...iconProps}
        className={cn("shrink-0", line.state === "working" && "motion-safe:animate-spin")}
      />
      <span className="min-w-0 break-all">{line.text}</span>
    </p>
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
      <div
        ref={log}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        onScroll={(event) => {
          const el = event.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="min-h-0 flex-1 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="text-muted text-[13px]">
            <p className="text-text font-medium">Describe what to build</p>
            <p className="mt-1">
              For example: a landing page for a coffee shop. The assistant creates and edits files
              in this project.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((message) => (
              <li key={message.id} className="text-sm">
                <p className="text-muted mb-0.5 text-xs font-medium">
                  {message.role === "user" ? "You" : "Assistant"}
                </p>
                <MessageBody message={message} />
              </li>
            ))}
            {status === "submitted" ? (
              <li className="text-muted flex items-center gap-2 text-xs">
                <FileText {...iconProps} />
                Working
              </li>
            ) : null}
          </ol>
        )}
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

      <form onSubmit={submit} className="border-hairline border-t p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={3}
          maxLength={MAX_CHARS}
          value={input}
          disabled={!enabled}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="border-input-border bg-surface placeholder:text-subtle w-full resize-none rounded-md border p-2 text-sm disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
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
      </form>
    </div>
  );
}
