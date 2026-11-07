// Runtime switches for the assistant. All read lazily so tests can change them.

export type ModelMode = "openrouter" | "fake";

export function aiDisabled(): boolean {
  const value = process.env["AI_DISABLED"]?.trim().toLowerCase();
  return value === "true" || value === "1";
}

// Credits one account may spend in a rolling day. The default is above the 20-credit signup grant
// so it only matters for accounts that have been topped up.
export function dailyCreditCap(): number {
  const parsed = Number(process.env["AI_DAILY_CREDIT_CAP"]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

export function modelMode(): ModelMode {
  const requested = process.env["AI_MODEL_MODE"]?.trim().toLowerCase();
  if (requested !== "fake") return "openrouter";
  // A real key in production means this is a live deployment: refuse the fake model rather than
  // silently serving canned answers (or serving them for free).
  if (process.env.NODE_ENV === "production" && process.env["OPENROUTER_API_KEY"]) {
    throw new Error(
      "AI_MODEL_MODE=fake is not allowed when OPENROUTER_API_KEY is set in production",
    );
  }
  return "fake";
}

export const MAX_STEPS = 12;
export const MAX_MESSAGE_CHARS = 8000;
export const HISTORY_MESSAGES = 20;
export const SNAPSHOT_BYTES = 60_000;
export const REQUEST_TIMEOUT_MS = 120_000;
