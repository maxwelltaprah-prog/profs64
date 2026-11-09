import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { FREE_WINDOW_EVENT } from "@/lib/agent/free-window";
import { notFound } from "@/lib/security/errors";

import { isUuid, translateDbError } from "./projects";
import { createSupabaseServerClient } from "./supabase-server";

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredConversationMessage {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
  createdAt: string;
}

export interface ConversationDocument {
  id: string;
  kind: "pptx" | "docx" | "pdf";
  title: string;
  spec: unknown;
}

// Reads run as the signed-in user, so row level security limits them to their own conversations;
// someone else's conversation looks exactly like one that does not exist.

export async function listConversations(
  supabase?: SupabaseClient,
  limit = 50,
): Promise<Conversation[]> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw translateDbError(error);
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
}

export async function getConversation(
  id: string,
  supabase?: SupabaseClient,
): Promise<Conversation> {
  if (!isUuid(id)) throw notFound();
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversations")
    .select("id, title, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw translateDbError(error);
  if (!data) throw notFound();
  return { id: data.id, title: data.title, updatedAt: data.updated_at };
}

export async function createConversation(
  ownerId: string,
  title: string,
  supabase?: SupabaseClient,
): Promise<Conversation> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversations")
    .insert({ owner_id: ownerId, title })
    .select("id, title, updated_at")
    .single();
  if (error) throw translateDbError(error);
  return { id: data.id, title: data.title, updatedAt: data.updated_at };
}

export async function listConversationMessages(
  id: string,
  supabase?: SupabaseClient,
): Promise<StoredConversationMessage[]> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversation_messages")
    .select("id, role, parts, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw translateDbError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    parts: Array.isArray(row.parts) ? row.parts : [],
    createdAt: row.created_at,
  }));
}

export async function getConversationDocument(
  conversationId: string,
  documentId: string,
  supabase?: SupabaseClient,
): Promise<ConversationDocument> {
  if (!isUuid(conversationId) || !isUuid(documentId)) throw notFound();
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("conversation_documents")
    .select("id, kind, title, spec")
    .eq("id", documentId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw translateDbError(error);
  if (!data) throw notFound();
  return { id: data.id, kind: data.kind, title: data.title, spec: data.spec };
}

// The newest free-window start for the signed-in user (their own audit rows, read under RLS).
export async function latestFreeWindowStart(supabase: SupabaseClient): Promise<Date | null> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("created_at")
    .eq("event", FREE_WINDOW_EVENT)
    .order("id", { ascending: false })
    .limit(1);
  const at = (data as Array<{ created_at: string }> | null)?.[0]?.created_at;
  return error || !at ? null : new Date(at);
}
