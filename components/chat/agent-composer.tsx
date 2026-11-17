"use client";

import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import { forwardRef, useRef, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";
import { IMAGE_ACCEPT } from "@/lib/workspace/chat-images";

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
    // Pictures for a deck. Shown as removable chips above the box.
    attachments?: { key: string; name: string }[] | undefined;
    onAttach?: ((files: File[]) => void) | undefined;
    onRemoveAttachment?: ((key: string) => void) | undefined;
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
    attachments = [],
    onAttach,
    onRemoveAttachment,
  },
  ref,
) {
  const picker = useRef<HTMLInputElement>(null);
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
      {attachments.length > 0 ? (
        <ul aria-label="Attached pictures" className="flex flex-wrap gap-1.5 px-3 pb-2">
          {attachments.map((item) => (
            <li
              key={item.key}
              className="border-hairline bg-surface-2 flex max-w-full items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
            >
              <span className="truncate">{item.name}</span>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemoveAttachment?.(item.key)}
                className="hover:bg-surface text-muted flex size-5 items-center justify-center rounded-full"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        {onAttach ? (
          <>
            <input
              ref={picker}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length > 0) onAttach(files);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Attach pictures"
              title="Attach PNG or JPEG pictures to use in a deck"
              onClick={() => picker.current?.click()}
              disabled={disabled}
            >
              <ImagePlus {...iconProps} />
            </Button>
          </>
        ) : null}
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
