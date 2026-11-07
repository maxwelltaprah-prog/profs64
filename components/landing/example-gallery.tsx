"use client";

import { cn } from "@/lib/utils/cn";

import { PICK_EXAMPLE_EVENT } from "./prompt-box";

// Starting points. Each card carries the full prompt it will put in the box, and a small
// schematic of the page that prompt tends to produce, drawn with plain blocks rather than a
// screenshot so the gallery never over-promises.

type Block = "bar" | "hero" | "row" | "grid" | "list" | "form" | "stat";

interface Example {
  title: string;
  kind: string;
  prompt: string;
  layout: readonly Block[];
}

const EXAMPLES: readonly Example[] = [
  {
    title: "Coffee shop",
    kind: "Landing page",
    prompt:
      "A landing page for a coffee shop called Bean There: a hero with the name and a tagline, a menu of six drinks with prices, opening hours and an address block.",
    layout: ["bar", "hero", "list", "row"],
  },
  {
    title: "Habit tracker",
    kind: "Personal tool",
    prompt:
      "A habit tracker: add habits, tick them off per day on a weekly grid, and show the current streak for each. Keep the state in localStorage.",
    layout: ["bar", "stat", "grid"],
  },
  {
    title: "Expense log",
    kind: "Internal tool",
    prompt:
      "An expense log for a small team: a form to add an expense with amount, category and date, a table of entries, and a running total for the month.",
    layout: ["bar", "form", "list", "stat"],
  },
  {
    title: "Portfolio",
    kind: "Personal site",
    prompt:
      "A portfolio site for a product designer: a short intro, a grid of six projects with titles and one-line descriptions, and a contact form.",
    layout: ["bar", "hero", "grid", "form"],
  },
  {
    title: "Status page",
    kind: "Operations",
    prompt:
      "A status page for a SaaS product: overall status at the top, a list of six services with their current state, and a history of the last five incidents.",
    layout: ["bar", "stat", "list", "list"],
  },
  {
    title: "Event sign-up",
    kind: "Form",
    prompt:
      "A sign-up page for a one-day workshop: event details, a schedule with four sessions, and a registration form with name, email and a dietary note.",
    layout: ["bar", "hero", "row", "form"],
  },
];

function Schematic({ layout }: { layout: readonly Block[] }) {
  return (
    <div
      aria-hidden="true"
      className="bg-surface-2 border-hairline flex aspect-[4/3] flex-col gap-1.5 rounded-md border p-3"
    >
      {layout.map((block, index) => (
        <div
          key={`${block}-${index}`}
          className={cn(
            "bg-hairline-strong rounded-sm",
            block === "bar" && "h-1.5 w-1/3",
            block === "hero" && "h-6 w-3/4",
            block === "row" && "h-2 w-full",
            block === "stat" && "h-4 w-1/4",
            block === "form" && "h-5 w-2/3",
            block === "list" && "h-2 w-5/6",
            block === "grid" && "grid flex-1 grid-cols-3 gap-1.5 bg-transparent",
          )}
        >
          {block === "grid"
            ? Array.from({ length: 6 }, (_, cell) => (
                <div key={cell} className="bg-hairline-strong rounded-sm" />
              ))
            : null}
        </div>
      ))}
    </div>
  );
}

export function ExampleGallery() {
  const pick = (prompt: string) => {
    window.dispatchEvent(new CustomEvent(PICK_EXAMPLE_EVENT, { detail: prompt }));
  };

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Starting points">
      {EXAMPLES.map((example) => (
        <li key={example.title}>
          <button
            type="button"
            onClick={() => pick(example.prompt)}
            className="lift border-hairline bg-surface hover:border-hairline-strong group block w-full rounded-lg border p-3 text-left"
          >
            <Schematic layout={example.layout} />
            <div className="mt-3 flex items-baseline justify-between gap-3 px-1">
              <span className="text-[15px] font-medium">{example.title}</span>
              <span className="text-subtle text-xs">{example.kind}</span>
            </div>
            <p className="text-muted mt-1 line-clamp-2 px-1 text-[13px] leading-5">
              {example.prompt}
            </p>
            <span className="text-accent transition-ui mt-3 block px-1 text-[13px] font-medium underline-offset-4 group-hover:underline">
              Use this description
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
