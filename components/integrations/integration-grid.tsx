"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { INTEGRATION_CATEGORIES, INTEGRATIONS, type Integration } from "@/lib/integrations/catalog";

function Card({ integration, joined }: { integration: Integration; joined: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    joined ? "done" : "idle",
  );

  const join = async () => {
    setState("sending");
    try {
      const response = await fetch("/api/integrations/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ integration: integration.id }),
      });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <li className="lift border-hairline bg-surface flex flex-col rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-accent-subtle text-accent flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
        >
          {integration.name.charAt(0)}
        </span>
        <h3 className="text-sm font-semibold">{integration.name}</h3>
        <span className="text-subtle border-hairline ml-auto rounded-full border px-2 py-0.5 text-[11px]">
          Planned
        </span>
      </div>
      <p className="text-muted mt-3 flex-1 text-[13px] leading-5">{integration.blurb}</p>
      {state === "done" ? (
        <p
          role="status"
          className="text-accent mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium"
        >
          <Check {...iconProps} /> You&apos;ll be told
        </p>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4 w-full justify-center"
          loading={state === "sending"}
          onClick={() => void join()}
        >
          Notify me
        </Button>
      )}
      {state === "error" ? (
        <p role="alert" className="text-danger mt-2 text-xs">
          Could not save that. Try again.
        </p>
      ) : null}
    </li>
  );
}

export function IntegrationGrid({ interested }: { interested: readonly string[] }) {
  return (
    <div className="flex flex-col gap-9">
      {INTEGRATION_CATEGORIES.map((category) => (
        <section key={category} aria-label={category}>
          <h2 className="text-sm font-semibold tracking-tight">{category}</h2>
          <ul className="card-in mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.filter((integration) => integration.category === category).map(
              (integration) => (
                <Card
                  key={integration.id}
                  integration={integration}
                  joined={interested.includes(integration.id)}
                />
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
