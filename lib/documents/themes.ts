import { type DeckSpec } from "./spec";

// Colours and fonts for decks. Shared by the .pptx renderer and the in-chat preview, so what the
// person previews is what they download. No server-only code here: the browser imports it too.
export interface Theme {
  font: string;
  primary: string; // cover background and titles
  accent: string;
  tint: string; // very light accent wash for callouts
  ink: string;
  muted: string;
  line: string;
  surface: string;
  series: string[];
  academic: boolean;
}

const BASE = { ink: "1F2328", muted: "5F6670", line: "DDE1E6", surface: "F5F7F9" };
const THEMES: Record<string, Theme> = {
  teal: {
    ...BASE,
    font: "Calibri",
    primary: "0B4F4A",
    accent: "0F766E",
    tint: "E6F4F2",
    series: ["0F766E", "F59E0B", "64748B", "1D4ED8"],
    academic: false,
  },
  navy: {
    ...BASE,
    font: "Calibri",
    primary: "14284B",
    accent: "2563EB",
    tint: "E8EFFC",
    series: ["2563EB", "F59E0B", "0F766E", "64748B"],
    academic: false,
  },
  slate: {
    ...BASE,
    font: "Calibri",
    primary: "1F2937",
    accent: "475569",
    tint: "EEF1F5",
    series: ["475569", "0EA5E9", "F59E0B", "16A34A"],
    academic: false,
  },
  terracotta: {
    ...BASE,
    font: "Calibri",
    primary: "4A2A1E",
    accent: "C2410C",
    tint: "FBEDE5",
    series: ["C2410C", "0F766E", "CA8A04", "475569"],
    academic: false,
  },
};
const ACADEMIC: Theme = {
  font: "Arial",
  primary: "1F4E79",
  accent: "2E75B6",
  tint: "EBF3FA",
  ink: "2D2D2D",
  muted: "777777",
  line: "CCCCCC",
  surface: "F7F9FB",
  series: ["1F4E79", "2E75B6", "C55A11", "777777"],
  academic: true,
};

export function themeFor(spec: DeckSpec): Theme {
  if (spec.style === "academic") return ACADEMIC;
  return THEMES[spec.theme ?? "teal"] ?? (THEMES["teal"] as Theme);
}
