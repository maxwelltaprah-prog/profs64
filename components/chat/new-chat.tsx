"use client";

import { FileText, MessageCircleQuestion, Presentation, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { AgentComposer } from "@/components/chat/agent-composer";
import { AGENT_SUGGESTIONS, firstMessageKey, titleFromPrompt } from "@/lib/workspace/agent";

const ICONS = [Presentation, FileText, ScrollText, MessageCircleQuestion];

// Starts a conversation: creates it, keeps the first message for the conversation page to send,
// and opens it. The message is never put in the URL.
export function NewChat({ greeting }: { greeting: string }) {
  const router = useRouter();
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: titleFromPrompt(message) }),
      });
      const body = (await response.json().catch(() => null)) as {
        conversation?: { id: string };
        error?: { message?: string };
      } | null;
      const id = body?.conversation?.id;
      if (!response.ok || !id) {
        setError(body?.error?.message ?? "Could not start the chat. Try again.");
        setBusy(false);
        return;
      }
      try {
        window.sessionStorage.setItem(firstMessageKey(id), message);
      } catch {
        // Without storage the conversation opens empty and the text stays in this box's history.
      }
      router.push(`/chat/${id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <h1 className="rise text-center text-[28px] leading-tight font-semibold tracking-[-0.02em] text-balance md:text-[34px]">
        {greeting}
      </h1>
      <p className="rise rise-1 text-muted mx-auto mt-2 max-w-lg text-center text-sm">
        Ask a question, think something through, or have the assistant make a PowerPoint deck, Word
        document or PDF for you to download.
      </p>
      <div className="rise rise-2 mt-7">
        <AgentComposer
          ref={box}
          value={text}
          onChange={setText}
          onSend={() => void start()}
          busy={busy}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle mt-3 rounded-lg border px-3 py-2 text-[13px]"
        >
          {error}
        </p>
      ) : null}
      <ul aria-label="Ideas" className="rise rise-3 mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AGENT_SUGGESTIONS.map((suggestion, index) => {
          const Icon = ICONS.at(index) ?? FileText;
          return (
            <li key={suggestion.label} className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setText(suggestion.prompt);
                  box.current?.focus();
                }}
                className="press border-hairline bg-surface hover:border-hairline-strong hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left"
              >
                <span className="bg-surface-2 border-hairline text-muted flex size-9 shrink-0 items-center justify-center rounded-lg border">
                  <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-sm font-medium">{suggestion.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
