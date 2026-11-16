"use client";

import { cn } from "@/lib/utils/cn";

// A row of category chips that filter a gallery: one active at a time, "All" first.
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | "All";
  onChange: (next: T | "All") => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {(["All", ...options] as Array<T | "All">).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "press rounded-full border px-3.5 py-1.5 text-[13px] font-medium",
            value === option
              ? "border-text bg-text text-bg"
              : "border-hairline-strong bg-surface text-muted hover:bg-surface-2 hover:text-text",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
