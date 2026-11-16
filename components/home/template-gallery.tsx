"use client";

import {
  BarChart3,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Gamepad2,
  Globe,
  HelpCircle,
  LayoutDashboard,
  ReceiptText,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FilterChips } from "@/components/ui/filter-chips";
import { createProjectForPrompt } from "@/lib/workspace/open-project";
import {
  type TemplateCategory,
  templatesByCategory,
  type ProjectTemplate,
} from "@/lib/workspace/templates";

const ICONS: Readonly<Record<string, LucideIcon>> = {
  "saas-landing": Globe,
  portfolio: Briefcase,
  restaurant: UtensilsCrossed,
  "crud-tasks": ClipboardList,
  crm: LayoutDashboard,
  invoice: ReceiptText,
  analytics: BarChart3,
  finance: Wallet,
  "memory-game": Gamepad2,
  quiz: HelpCircle,
  pomodoro: CalendarClock,
};

function TemplateCard({
  template,
  busy,
  onPick,
}: {
  template: ProjectTemplate;
  busy: boolean;
  onPick: (template: ProjectTemplate) => void;
}) {
  const Icon = ICONS[template.id] ?? Globe;
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={() => onPick(template)}
      className="lift press border-hairline bg-surface hover:border-hairline-strong flex w-full flex-col gap-2.5 rounded-xl border p-4 text-left disabled:opacity-60"
    >
      <span className="bg-surface-2 border-hairline text-muted flex size-10 items-center justify-center rounded-lg border">
        {busy ? (
          <span aria-hidden="true" className="spinner" />
        ) : (
          <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <span className="text-sm font-medium">{template.name}</span>
      <span className="text-muted text-[13px] leading-5">{template.description}</span>
    </button>
  );
}

// Picking a template creates a project and opens it; the workspace sends the template prompt as the
// first build message. One pick at a time.
export function TemplateGallery() {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TemplateCategory | "All">("All");
  const allGroups = templatesByCategory();
  const groups = allGroups.filter((group) => filter === "All" || group.category === filter);

  const pick = async (template: ProjectTemplate) => {
    if (busyId) return;
    setBusyId(template.id);
    setError(null);
    const result = await createProjectForPrompt(template.prompt);
    if (result.ok) {
      router.push(`/project/${result.projectId}`);
    } else {
      setError(result.message);
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <FilterChips
        label="Template category"
        options={allGroups.map((group) => group.category)}
        value={filter}
        onChange={setFilter}
      />
      {error ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle rounded-lg border px-3 py-2 text-[13px]"
        >
          {error}
        </p>
      ) : null}
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`cat-${group.category}`}>
          <h2 id={`cat-${group.category}`} className="text-sm font-semibold tracking-tight">
            {group.category}
          </h2>
          <div className="card-in mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                busy={busyId === template.id}
                onPick={() => void pick(template)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
