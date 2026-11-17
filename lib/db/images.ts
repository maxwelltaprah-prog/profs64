import { type SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/security/errors";

import { translateDbError } from "./projects";
import { createSupabaseServerClient } from "./supabase-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoredImage {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

// Inserted with the person's own session, so RLS decides whether the conversation is theirs.
export async function insertConversationImage(
  conversationId: string,
  image: Omit<StoredImage, "id"> & { data: string },
  supabase?: SupabaseClient,
): Promise<StoredImage> {
  if (!UUID.test(conversationId)) throw new AppError(404, "not_found", "Not found.");
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversation_images")
    .insert({ conversation_id: conversationId, ...image })
    .select("id")
    .single();
  if (error || !data) throw translateDbError(error);
  return {
    id: data.id,
    name: image.name,
    mime: image.mime,
    width: image.width,
    height: image.height,
  };
}

// Which of these ids are pictures in this conversation (RLS limits it to the owner's).
export async function existingImageIds(
  conversationId: string,
  ids: readonly string[],
  supabase?: SupabaseClient,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversation_images")
    .select("id")
    .eq("conversation_id", conversationId)
    .in(
      "id",
      ids.filter((id) => UUID.test(id)),
    );
  if (error) throw translateDbError(error);
  return new Set((data ?? []).map((row: { id: string }) => row.id));
}

export async function loadImageBytes(
  conversationId: string,
  ids: readonly string[],
  supabase?: SupabaseClient,
): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  if (ids.length === 0) return out;
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversation_images")
    .select("id, data")
    .eq("conversation_id", conversationId)
    .in(
      "id",
      ids.filter((id) => UUID.test(id)),
    );
  if (error) throw translateDbError(error);
  for (const row of (data ?? []) as { id: string; data: string }[]) {
    out.set(row.id, new Uint8Array(Buffer.from(row.data, "base64")));
  }
  return out;
}
