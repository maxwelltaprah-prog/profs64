"use client";

import { RefreshCw, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { iconProps } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import { speechChunks } from "@/lib/workspace/speech-text";

export const REPLY_BUTTON =
  "press text-subtle hover:text-text hover:bg-surface-2 inline-flex size-7 items-center justify-center rounded-md disabled:opacity-40";

// Reads a reply aloud with the browser's own speech engine; nothing is sent anywhere. Hidden when
// the browser has no speech synthesis. Only one reply speaks at a time, and it stops when the
// button is pressed again or the reply leaves the page.
export function ReadAloudButton({ text, className }: { text: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    // Only the browser knows whether speech synthesis exists, so this is decided after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      run.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const start = () => {
    const chunks = speechChunks(text);
    if (chunks.length === 0) return;
    window.speechSynthesis.cancel();
    const ticket = ++run.current;
    setSpeaking(true);
    const speak = (index: number) => {
      if (ticket !== run.current) return;
      const chunk = chunks[index];
      if (chunk === undefined) {
        setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = document.documentElement.lang || "en";
      utterance.onend = () => speak(index + 1);
      utterance.onerror = () => {
        if (ticket === run.current) setSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    };
    speak(0);
  };

  if (!supported) return null;
  return (
    <button
      type="button"
      aria-label={speaking ? "Stop reading" : "Read reply aloud"}
      aria-pressed={speaking}
      title={speaking ? "Stop reading" : "Read aloud"}
      onClick={speaking ? stop : start}
      className={cn(REPLY_BUTTON, speaking && "bg-accent-subtle text-accent", className)}
    >
      {speaking ? <Square {...iconProps} size={14} /> : <Volume2 {...iconProps} />}
    </button>
  );
}

// Asks for a new reply to the same question. The old reply is replaced and the new one is charged
// like any other.
export function RegenerateButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Regenerate reply"
      title="Regenerate (uses credits)"
      disabled={disabled}
      onClick={onClick}
      className={REPLY_BUTTON}
    >
      <RefreshCw {...iconProps} />
    </button>
  );
}
