"use client";

import { type StoredMessage } from "@/lib/db/projects";

// Text of a stored message. Tool and other part types are summarised by the streaming UI added
// with the chat route; here only plain text parts are shown, always as text, never as HTML.
function textOf(message: StoredMessage): string {
  return message.parts
    .map((part) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part
      ) {
        return typeof part.text === "string" ? part.text : "";
      }
      return "";
    })
    .join("");
}

export function ChatPanel({
  messages,
  canUseAssistant,
}: {
  messages: StoredMessage[];
  canUseAssistant: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4" role="log" aria-label="Conversation">
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
                <p className="whitespace-pre-wrap">{textOf(message)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="border-hairline border-t p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={3}
          disabled={!canUseAssistant}
          placeholder={
            canUseAssistant
              ? "Describe what to build"
              : "Confirm your email address to use the assistant"
          }
          className="border-input-border bg-surface placeholder:text-subtle w-full resize-none rounded-md border p-2 text-sm disabled:opacity-60"
        />
      </div>
    </div>
  );
}
