"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { creditsPerDollar, CREDIT_PACKS } from "@/lib/credits/packs";

// A top-up offer that opens where the person ran out, so they do not have to leave their work.
// There is no payment provider connected yet, so each pack records a "tell me when" request on the
// same list the pricing page uses; nothing is charged. When checkout exists it plugs in here.
export function TopUpButton({ label = "Top up credits" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? <TopUpDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TopUpDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState<Record<string, "sending" | "done" | "error">>({});

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const join = async (pack: string) => {
    setDone((current) => ({ ...current, [pack]: "sending" }));
    try {
      const response = await fetch("/api/billing/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      setDone((current) => ({ ...current, [pack]: response.ok ? "done" : "error" }));
    } catch {
      setDone((current) => ({ ...current, [pack]: "error" }));
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="topup-title"
      onClose={onClose}
      className="glass border-hairline m-auto w-[min(94vw,30rem)] rounded-2xl border p-0 backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="topup-title" className="text-base font-semibold">
              Top up credits
            </h2>
            <p className="text-muted mt-1 text-[13px] leading-5">
              Buying credits is not open yet, so nothing is charged. Choose a pack and we will tell
              you when it is. Your daily credits refill on their own, and your work is kept.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
          >
            <X {...iconProps} />
          </Button>
        </div>
        <ul className="flex flex-col gap-2">
          {CREDIT_PACKS.map((pack) => {
            const state = done[pack.id];
            return (
              <li
                key={pack.id}
                className="border-hairline bg-surface flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {pack.name} · ${pack.priceUsd}
                  </p>
                  <p className="text-muted text-xs tabular-nums">
                    {pack.credits.toLocaleString()} credits · {creditsPerDollar(pack)} per $1
                  </p>
                </div>
                {state === "done" ? (
                  <p
                    role="status"
                    className="text-accent inline-flex items-center gap-1 text-[13px] font-medium"
                  >
                    <Check {...iconProps} />
                    On the list
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={state === "sending"}
                    onClick={() => void join(pack.id)}
                  >
                    Notify me
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {Object.values(done).includes("error") ? (
          <p role="alert" className="text-danger text-xs">
            Could not save that. Try again.
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
