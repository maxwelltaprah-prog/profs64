"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { markAsked, requestNotifications } from "@/lib/workspace/notify";

// Asked once, right after the first message is sent, so the person sees why it would help.
export function NotifyPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const dismiss = () => {
    markAsked();
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="notify-title"
      onClose={dismiss}
      className="glass border-hairline-strong text-text m-auto w-[min(460px,calc(100vw-2rem))] rounded-xl border p-0 shadow-[0_24px_64px_rgb(0_0_0/0.28)] backdrop:bg-black/30"
    >
      <div className="flex items-start gap-3.5 p-5">
        <span className="bg-accent-subtle text-accent flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Bell {...iconProps} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="notify-title" className="text-base font-semibold tracking-tight">
            Get notified when the assistant is done
          </h2>
          <p className="text-muted mt-1.5 text-[13px] leading-5">
            Only while you are in another tab or window. The notification never includes your
            message or the reply.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={dismiss}>
          <X {...iconProps} />
        </Button>
      </div>
      <div className="border-hairline flex justify-end gap-2 border-t px-5 py-3">
        <Button variant="secondary" size="sm" onClick={dismiss}>
          Not now
        </Button>
        <Button
          size="sm"
          onClick={() => {
            void requestNotifications().finally(onClose);
          }}
        >
          Allow notifications
        </Button>
      </div>
    </dialog>
  );
}
