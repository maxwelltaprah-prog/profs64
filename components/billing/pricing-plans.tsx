"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { creditsPerDollar, CREDIT_PACKS, type CreditPack } from "@/lib/credits/packs";
import { cn } from "@/lib/utils/cn";

function PackCard({ pack, joined }: { pack: CreditPack; joined: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    joined ? "done" : "idle",
  );

  const join = async () => {
    setState("sending");
    try {
      const response = await fetch("/api/billing/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack: pack.id }),
      });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div
      className={cn(
        "lift border-hairline bg-surface relative flex flex-col rounded-2xl border p-5",
        pack.popular && "border-accent ring-accent/20 ring-2",
      )}
    >
      {pack.popular ? (
        <span className="bg-accent text-accent-fg absolute -top-2.5 left-5 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
          Most popular
        </span>
      ) : null}
      <h3 className="text-sm font-semibold">{pack.name}</h3>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">${pack.priceUsd}</span>
      </p>
      <p className="text-muted mt-1 text-[13px]">
        <span className="text-text font-medium tabular-nums">{pack.credits.toLocaleString()}</span>{" "}
        credits · {creditsPerDollar(pack)} per $1
      </p>
      <p className="text-muted mt-3 flex-1 text-[13px] leading-6">{pack.blurb}</p>
      {state === "done" ? (
        <p
          className="text-accent mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium"
          role="status"
        >
          <Check {...iconProps} />
          You&apos;re on the list
        </p>
      ) : (
        <Button
          variant={pack.popular ? "primary" : "secondary"}
          className="mt-5 w-full justify-center"
          loading={state === "sending"}
          onClick={() => void join()}
        >
          Notify me
        </Button>
      )}
      {state === "error" ? (
        <p className="text-danger mt-2 text-xs" role="alert">
          Could not save that. Try again.
        </p>
      ) : null}
    </div>
  );
}

export function PricingPlans({ joined }: { joined: readonly string[] }) {
  return (
    <div className="card-in mt-5 grid gap-4 sm:grid-cols-3">
      {CREDIT_PACKS.map((pack) => (
        <PackCard key={pack.id} pack={pack} joined={joined.includes(pack.id)} />
      ))}
    </div>
  );
}
