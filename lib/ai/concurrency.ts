import { REQUEST_TIMEOUT_MS } from "./config";

// One live assistant response per account at a time (per server instance). Without this, several
// parallel requests could each pass the balance check before any of them is billed. Entries expire
// on their own so a lost release can never lock someone out for longer than one request lifetime.
const LEASE_MS = REQUEST_TIMEOUT_MS + 30_000;
const active = new Map<string, number>();

export function tryAcquire(userId: string, now: number = Date.now()): (() => void) | null {
  const started = active.get(userId);
  if (started !== undefined && now - started < LEASE_MS) return null;
  active.set(userId, now);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (active.get(userId) === now) active.delete(userId);
  };
}
