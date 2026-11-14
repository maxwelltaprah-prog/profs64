"use client";

import Image from "next/image";

import { cn } from "@/lib/utils/cn";

import { PICK_EXAMPLE_EVENT } from "./prompt-box";

interface Example {
  title: string;
  kind: string;
  prompt: string;
  preview: string;
}

const EXAMPLES: readonly Example[] = [
  {
    title: "Coffee shop",
    kind: "Landing page",
    prompt:
      "A landing page for a coffee shop called Bean There: a hero with the name and a tagline, a menu of six drinks with prices, opening hours and an address block.",
    preview: "/project-previews/coffee-shop.svg",
  },
  {
    title: "Habit tracker",
    kind: "Personal tool",
    prompt:
      "A habit tracker: add habits, tick them off per day on a weekly grid, and show the current streak for each. Keep the state in localStorage.",
    preview: "/project-previews/habit-tracker.svg",
  },
  {
    title: "Expense log",
    kind: "Internal tool",
    prompt:
      "An expense log for a small team: a form to add an expense with amount, category and date, a table of entries, and a running total for the month.",
    preview: "/project-previews/expense-log.svg",
  },
  {
    title: "Portfolio",
    kind: "Personal site",
    prompt:
      "A portfolio site for a product designer: a short intro, a grid of six projects with titles and one-line descriptions, and a contact form.",
    preview: "/project-previews/portfolio.svg",
  },
  {
    title: "Status page",
    kind: "Operations",
    prompt:
      "A status page for a SaaS product: overall status at the top, a list of six services with their current state, and a history of the last five incidents.",
    preview: "/project-previews/status-page.svg",
  },
  {
    title: "Event sign-up",
    kind: "Form",
    prompt:
      "A sign-up page for a one-day workshop: event details, a schedule with four sessions, and a registration form with name, email and a dietary note.",
    preview: "/project-previews/event-sign-up.svg",
  },
];

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
            className="lift ring-line bg-surface group block w-full rounded-xl p-3 text-left"
          >
            <div className="border-hairline aspect-[4/3] overflow-hidden rounded-md border">
              <Image
                src={example.preview}
                alt=""
                aria-hidden="true"
                width={640}
                height={480}
                className={cn(
                  "block h-full w-full object-cover transition-transform duration-300",
                  "group-hover:scale-[1.02] motion-reduce:transition-none",
                )}
              />
            </div>
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
