import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { readUsage } from "@/lib/ai/messages";
import { notFound } from "@/lib/security/errors";
import { type OutputInfo, type Rating } from "@/lib/workspace/outputs";

import { isUuid, type StoredMessage } from "./projects";
import { createSupabaseServerClient } from "./supabase-server";

// What the workspace shows under each reply: what it cost and the person's own thumbs up or down.
// Both are read as the signed-in user, so row level security keeps them to their own projects.

export const FEEDBACK_EVENT = "message_feedback";

// Feedback is recorded as audit events (append-only, owned by the person who made them), so no
// schema change is needed: the newest event for a message is the current choice, and "none"
// clears it. The event holds only ids and the rating, never message text.
export async function listRatings(
  projectId: string,
  supabase?: SupabaseClient,
): Promise<Map<string, Rating>> {
  if (!isUuid(projectId)) throw notFound();
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("audit_log")
    .select("metadata")
    .eq("event", FEEDBACK_EVENT)
    .eq("metadata->>projectId", projectId)
    .order("id", { ascending: false })
    .limit(500);
  if (error) return new Map();
  const ratings = new Map<string, Rating>();
  const seen = new Set<string>();
  for (const row of data as Array<{ metadata: Record<string, unknown> }>) {
    const messageId = row.metadata["messageId"];
    const rating = row.metadata["rating"];
    if (typeof messageId !== "string" || seen.has(messageId)) continue;
    seen.add(messageId);
    if (rating === "up" || rating === "down") ratings.set(messageId, rating);
  }
  return ratings;
}

export function outputsFor(
  messages: readonly StoredMessage[],
  ratings: ReadonlyMap<string, Rating>,
): Record<string, OutputInfo> {
  const outputs: Record<string, OutputInfo> = {};
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    outputs[message.id] = {
      usage: readUsage(message.parts),
      rating: ratings.get(message.id) ?? null,
    };
  }
  return outputs;
}
