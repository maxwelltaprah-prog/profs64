import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

// Stop requests. On Vercel the browser disconnecting does not cancel a running chat response, so
// pressing Stop also records a `chat_stop` audit event, and the running chat request checks for a
// new one every second or so. Audit events are append-only and owned by the person, so this needs
// no schema change. A request only reacts to events newer than the newest one at its start, so an
// old Stop can never cancel a later reply.

export const STOP_EVENT = "chat_stop";

/** Which running work a stop is for: a builder project or an agent conversation. */
export type StopScope = "projectId" | "conversationId";

// The metadata key each scope filters on, as a fixed allowlist so the filter column is never built
// from a value that could be influenced from outside this module.
const SCOPE_COLUMN = new Map<StopScope, string>([
  ["projectId", "metadata->>projectId"],
  ["conversationId", "metadata->>conversationId"],
]);
const columnFor = (scope: StopScope): string => SCOPE_COLUMN.get(scope) ?? "metadata->>projectId";

export async function latestStopId(
  projectId: string,
  supabase: SupabaseClient,
  scope: StopScope = "projectId",
): Promise<number> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id")
    .eq("event", STOP_EVENT)
    .eq(columnFor(scope), projectId)
    .order("id", { ascending: false })
    .limit(1);
  const id = (data as Array<{ id: number }> | null)?.[0]?.id;
  return error || typeof id !== "number" ? 0 : id;
}

// A failed read counts as "no stop requested": the reply keeps going and the other limits (step
// cap, timeout, daily cap) still bound the cost.
export async function stopRequestedSince(
  projectId: string,
  afterId: number,
  supabase: SupabaseClient,
  scope: StopScope = "projectId",
): Promise<boolean> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id")
    .eq("event", STOP_EVENT)
    .eq(columnFor(scope), projectId)
    .gt("id", afterId)
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}
