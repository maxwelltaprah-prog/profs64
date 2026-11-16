import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { summariseUsage, type LedgerRow, type UsageSummary } from "@/lib/workspace/usage";

import { createSupabaseServerClient } from "./supabase-server";

// The signed-in person's own ledger, read under RLS (ledger_select_own). A failed read yields an
// empty summary rather than breaking the page.
export async function loadUsage(supabase?: SupabaseClient, limit = 2000): Promise<UsageSummary> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("credit_ledger")
    .select("delta, reason, project_id, model, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return summariseUsage([]);
  const rows: LedgerRow[] = data.map((row) => ({
    delta: Number(row.delta),
    reason: String(row.reason),
    projectId: row.project_id ?? null,
    model: row.model ?? null,
    createdAt: row.created_at,
  }));
  return summariseUsage(rows);
}
