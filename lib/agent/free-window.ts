// The free-model fallback for the chat agent. When a person's credits run out (balance too low or
// the daily cap reached), they get 24 hours on a free model. A new free window can start only after
// a further 24 hours, so it is a grace period, not a permanent free tier. Pure; tested directly.

export const FREE_WINDOW_EVENT = "free_window_started";
export const FREE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type FreeWindow =
  | { state: "active"; until: Date }
  | { state: "available" }
  | { state: "cooling-down"; availableAt: Date };

export function freeWindow(lastStart: Date | null, now: Date): FreeWindow {
  if (!lastStart || Number.isNaN(lastStart.getTime())) return { state: "available" };
  const end = lastStart.getTime() + FREE_WINDOW_MS;
  if (now.getTime() < end) return { state: "active", until: new Date(end) };
  const availableAt = end + FREE_COOLDOWN_MS;
  if (now.getTime() < availableAt)
    return { state: "cooling-down", availableAt: new Date(availableAt) };
  return { state: "available" };
}
