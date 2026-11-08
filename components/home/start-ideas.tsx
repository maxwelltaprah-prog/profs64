"use client";

import {
  BarChart3,
  Briefcase,
  Gamepad2,
  Globe,
  ListChecks,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { PICK_EXAMPLE_EVENT } from "@/components/landing/prompt-box";
import { START_IDEAS } from "@/lib/workspace/home";

const ICONS: Readonly<Record<string, LucideIcon>> = {
  website: Globe,
  tool: Wrench,
  dashboard: BarChart3,
  tracker: ListChecks,
  game: Gamepad2,
  portfolio: Briefcase,
};

// Picking an idea fills the prompt box above with a starting description to edit; nothing is sent.
export function StartIdeas() {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {START_IDEAS.map((idea) => {
        const Icon = ICONS[idea.id] ?? Globe;
        return (
          <li key={idea.id} className="min-w-0">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent(PICK_EXAMPLE_EVENT, { detail: idea.prompt }))
              }
              className="press border-hairline bg-surface hover:border-hairline-strong hover:bg-surface-2 flex w-full items-center gap-3.5 rounded-xl border p-3 text-left"
            >
              <span className="bg-surface-2 border-hairline text-muted flex size-10 shrink-0 items-center justify-center rounded-lg border">
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{idea.title}</span>
                <span className="text-muted block truncate text-[13px]">{idea.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
