"use client";

import { ArrowUp, Square } from "lucide-react";
import { forwardRef, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";

// The chat agent's message box. Enter sends and Shift+Enter adds a line, as in other chat apps.
export const AgentComposer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop?: () => void;
    busy?: boolean;
    disabled?: boolean;
    placeholder?: string;
    id?: string;
  }
>(function AgentComposer(
  {
    value,
    onChange,
    onSend,
    onStop,
    busy = false,
    disabled = false,
    placeholder = "Ask anything, or ask for a deck, document or PDF",
    id = "agent-input",
  },
  ref,
) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy && value.trim()) onSend();
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && value.trim()) onSend();
      }}
      className="ring-line-focus border-input bg-surface rounded-2xl border shadow-[0_8px_30px_rgb(0_0_0/0.06)]"
    >
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={2}
        value={value}
        maxLength={CHAT_TEXT_MAX_CHARS}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="placeholder:text-subtle field-sizing-content max-h-60 min-h-16 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-6 focus-visible:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <p className="text-subtle hidden text-xs sm:block">
          Enter to send, Shift+Enter for a new line
        </p>
        {busy && onStop ? (
          <Button type="button" variant="secondary" size="sm" onClick={onStop} className="ml-auto">
            <Square {...iconProps} />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            aria-label="Send"
            disabled={disabled || value.trim().length === 0}
            className="ml-auto size-9 justify-center rounded-full"
          >
            <ArrowUp {...iconProps} />
          </Button>
        )}
      </div>
    </form>
  );
});
