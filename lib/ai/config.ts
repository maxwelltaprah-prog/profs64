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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
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

// The last allowed step cannot call tools, so a reply always ends with a written summary instead
// of being cut off in the middle of work. Earlier steps are left as they are.
// A spending guard as well: once one request has cost REQUEST_CREDIT_CAP credits, the next step
// cannot call tools either, so a runaway job stops with a summary of what was done. The person
// can send "continue" to carry on. Without it a single large request used 15.66 of 20 credits.
export const REQUEST_CREDIT_CAP = 10;
export function stepSettings(
  stepNumber: number,
  spentCredits = 0,
): { toolChoice: "none" } | undefined {
  return stepNumber >= MAX_STEPS - 1 || spentCredits >= REQUEST_CREDIT_CAP
    ? { toolChoice: "none" }
    : undefined;
}
export const MAX_MESSAGE_CHARS = 8000;
export const HISTORY_MESSAGES = 20;
export const SNAPSHOT_BYTES = 60_000;
// Writing several large files is slow (a model emits perhaps 30 to 60 tokens a second), so a
// request that rewrites a whole site needs minutes. At 120 s such requests were cut off in the
// middle of a write: nothing was saved and the input was still billed.
export const REQUEST_TIMEOUT_MS = 270_000;
