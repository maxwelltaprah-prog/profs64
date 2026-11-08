"use client";

import { Check, Copy, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { iconProps } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import { creditsLabel, type OutputInfo, type Rating } from "@/lib/workspace/outputs";

type Note = "copied" | "copy-failed" | "shared" | null;

const NOTE_TEXT: Record<Exclude<Note, null>, string> = {
  copied: "Copied",
  "copy-failed": "Could not copy",
  shared: "Shared",
};

// Copy, like, dislike, share and the credits used, under one finished reply. Share uses the
// device's own share sheet when there is one and otherwise copies the text; it never creates a
// public link, so nothing leaves the person's account unless they send it themselves.
export function OutputBar({
  text,
  info,
  onRate,
}: {
  text: string;
  info: OutputInfo | undefined;
  onRate: (rating: Rating | null) => void;
}) {
  const [note, setNote] = useState<Note>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = (next: Note) => {
    setNote(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 1800);
  };

  const copy = async (done: Note) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(done);
    } catch {
      flash("copy-failed");
    }
  };

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        flash("shared");
      } catch {
        // The person closed the share sheet; nothing to report.
      }
      return;
    }
    await copy("copied");
  };

  const rating = info?.rating ?? null;
  const button =
    "press text-subtle hover:text-text hover:bg-surface-2 flex size-7 items-center justify-center rounded-md";

  return (
    <div className="mt-2 flex min-h-7 items-center gap-0.5">
      <button
        type="button"
        aria-label="Copy reply"
        onClick={() => void copy("copied")}
        className={button}
      >
        {note === "copied" ? (
          <Check {...iconProps} className="text-success" />
        ) : (
          <Copy {...iconProps} />
        )}
      </button>
      <button
        type="button"
        aria-label="Good reply"
        aria-pressed={rating === "up"}
        onClick={() => onRate(rating === "up" ? null : "up")}
        className={cn(button, rating === "up" && "bg-accent-subtle text-accent")}
      >
        <ThumbsUp {...iconProps} />
      </button>
      <button
        type="button"
        aria-label="Bad reply"
        aria-pressed={rating === "down"}
        onClick={() => onRate(rating === "down" ? null : "down")}
        className={cn(button, rating === "down" && "bg-danger-subtle text-danger")}
      >
        <ThumbsDown {...iconProps} />
      </button>
      <button
        type="button"
        aria-label="Share reply"
        onClick={() => void share()}
        className={button}
      >
        <Share2 {...iconProps} />
      </button>
      <span role="status" className="text-muted ml-1 text-xs">
        {note ? NOTE_TEXT[note] : null}
      </span>
      {info?.usage ? (
        <span
          className="text-subtle ml-auto pl-2 text-xs tabular-nums"
          title={`${info.usage.inputTokens.toLocaleString("en")} tokens in, ${info.usage.outputTokens.toLocaleString("en")} out`}
        >
          {creditsLabel(info.usage.credits)}
        </span>
      ) : null}
    </div>
  );
}
