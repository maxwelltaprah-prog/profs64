import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { freeWindow } from "@/lib/agent/free-window";
import { dailyCreditCap } from "@/lib/ai/config";
import { MIN_BALANCE_TO_START } from "@/lib/credits/math";

import { latestFreeWindowStart } from "./conversations";
import { creditsSpentToday } from "./service";

// For the conversation page: when the person is out of credits for today and their free window is
// open, the time it ends (so the page can say replies use a free model); otherwise null.
export async function openFreeWindowUntil(
  userId: string,
  balance: number,
  supabase: SupabaseClient,
): Promise<string | null> {
  const [spent, lastFree] = await Promise.all([
    creditsSpentToday(userId),
    latestFreeWindowStart(supabase),
  ]);
  if (balance >= MIN_BALANCE_TO_START && spent < dailyCreditCap()) return null;
  const window = freeWindow(lastFree, new Date());
  return window.state === "active" ? window.until.toISOString() : null;
}
