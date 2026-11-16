import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./supabase-server";

// Which packs the signed-in person has already asked about, read from their own audit rows so the
// pricing page can show "You're on the list" without a new table. A failed read shows none.
export async function joinedPacks(supabase?: SupabaseClient): Promise<string[]> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("audit_log")
    .select("metadata")
    .eq("event", "pack_waitlist")
    .limit(200);
  if (error || !data) return [];
  const packs = new Set<string>();
  for (const row of data as Array<{ metadata: Record<string, unknown> }>) {
    const pack = row.metadata?.["pack"];
    if (typeof pack === "string") packs.add(pack);
  }
  return [...packs];
}
