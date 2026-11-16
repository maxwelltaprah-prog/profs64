"use client";

import { MessageCircleHeart, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";

const MAX = 2000;

// A "Send feedback" button and dialog for beta testers. Sends the message and the page path.
export function FeedbackButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const close = () => {
    setOpen(false);
    if (state === "sent") {
      setMessage("");
      setState("idle");
    }
  };

  const send = async () => {
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim(), page: pathname }),
      });
      setState(response.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "press text-muted hover:bg-surface-2 hover:text-text flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px]"
        }
      >
        <MessageCircleHeart {...iconProps} />
        Send feedback
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="feedback-title"
        onClose={close}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="bg-surface border-hairline-strong text-text m-auto w-[min(460px,calc(100vw-2rem))] rounded-xl border p-0 shadow-md backdrop:bg-black/30"
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-0">
          <div>
            <h2 id="feedback-title" className="text-base font-semibold tracking-tight">
              Send feedback
            </h2>
            <p className="text-muted mt-1 text-[13px] leading-5">
              Something broken, confusing or missing? Tell us. We read every message.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={close}>
            <X {...iconProps} />
          </Button>
        </div>
        {state === "sent" ? (
          <div className="p-5">
            <p role="status" className="text-[13px]">
              Thank you. Your feedback was sent.
            </p>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="p-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (message.trim()) void send();
            }}
          >
            <label htmlFor="feedback-message" className="sr-only">
              Your feedback
            </label>
            <textarea
              id="feedback-message"
              value={message}
              maxLength={MAX}
              rows={5}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What happened, and what did you expect?"
              className="ring-line-focus border-input bg-surface w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
            />
            <p className="text-subtle mt-1 text-xs">Please do not include passwords or secrets.</p>
            {state === "error" ? (
              <p role="alert" className="text-danger mt-2 text-[13px]">
                Could not send that. Try again.
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={state === "sending"}
                disabled={!message.trim()}
              >
                Send
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
