"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { nextTheme, THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

const LABEL: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "System" };
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;

// Persists the choice in a cookie so the server can render the right theme with no flash and
// no inline script (which the CSP would block).
export function applyTheme(choice: ThemeChoice) {
  if (choice === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", choice);
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);
  const Icon = ICON[choice];

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[nextTheme(choice)]}.`}
      onClick={() => {
        const next = nextTheme(choice);
        setChoice(next);
        applyTheme(next);
      }}
    >
      <Icon {...iconProps} />
    </Button>
  );
}
