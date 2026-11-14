"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { applyTheme } from "@/components/theme-toggle";
import { iconProps } from "@/components/ui/icons";
import { type ThemeChoice } from "@/lib/theme";

const choices: ReadonlyArray<{
  value: ThemeChoice;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", description: "A bright workspace", icon: Sun },
  { value: "dark", label: "Dark", description: "A darker workspace", icon: Moon },
  { value: "system", label: "System", description: "Follow your device setting", icon: Monitor },
];

export function AppearanceSetting({ initial }: { initial: ThemeChoice }) {
  const [selected, setSelected] = useState(initial);

  return (
    <fieldset>
      <legend className="text-sm font-medium">Appearance</legend>
      <p className="text-muted mt-1 text-[13px]">
        Choose how Buildr looks. This preference is saved on this device.
      </p>
      <div role="radiogroup" aria-label="Color theme" className="mt-4 grid gap-2 sm:grid-cols-3">
        {choices.map(({ value, label, description, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected === value}
            onClick={() => {
              setSelected(value);
              applyTheme(value);
            }}
            className={`press border-hairline flex min-h-24 flex-col items-start justify-between rounded-xl border p-3 text-left ${
              selected === value
                ? "border-accent bg-accent-subtle text-text"
                : "bg-surface hover:bg-surface-2"
            }`}
          >
            <Icon {...iconProps} className={selected === value ? "text-accent" : "text-muted"} />
            <span>
              <span className="block text-[13px] font-medium">{label}</span>
              <span className="text-muted mt-0.5 block text-xs">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
