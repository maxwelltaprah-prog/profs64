import type { OutputUsage } from "@/lib/ai/messages";

// What the workspace knows about each assistant reply besides its text. Shared by the server
// (which reads it) and the browser (which shows it), so it holds types and one formatter only.

export type Rating = "up" | "down";

export interface OutputInfo {
  usage: OutputUsage | null;
  rating: Rating | null;
}

export const creditsLabel = (credits: number): string =>
  `${credits.toFixed(2)} ${credits === 1 ? "credit" : "credits"}`;
