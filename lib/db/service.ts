import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv, getServiceEnv } from "./env";

// The only module allowed to use the service role key. It exports a handful of named
// operations instead of a client, so callers cannot run arbitrary privileged queries, and
// ESLint forbids importing it from components and pages. Every function takes the user ID
// from already-verified server code; never pass a client-supplied ID.

function serviceClient() {
  return createClient(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    getServiceEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export async function recordAuditEvent(input: {
  userId: string | null;
  event: string;
  metadata?: Record<string, string | number | boolean | null>;
  requestId?: string;
}): Promise<void> {
  const { error } = await serviceClient().rpc("record_audit_event", {
    p_user_id: input.userId,
    p_event: input.event,
    p_metadata: input.metadata ?? {},
    p_request_id: input.requestId ?? null,
  });
  if (error) throw new Error(`audit write failed: ${error.code ?? "unknown"}`);
}

// Whether this email may create an account while the closed beta is on. The database trigger is
// the real gate; this only lets the sign-up form give a clear answer first. If the beta migration
// has not been applied, or the check fails, it answers "yes" and the trigger still decides.
export async function isEmailInvited(email: string): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc("is_email_invited", { p_email: email });
    if (error || typeof data !== "boolean") return true;
    return data;
  } catch {
    return true;
  }
}

export async function insertFeedback(input: {
  userId: string;
  message: string;
  page: string | null;
}): Promise<void> {
  const { error } = await serviceClient()
    .from("feedback")
    .insert({ user_id: input.userId, message: input.message, page: input.page });
  if (error) throw new Error(`feedback write failed: ${error.code ?? "unknown"}`);
}

export interface DeductionResult {
  charged: number;
  balanceAfter: number;
  shortfall: number;
}

export async function deductCredits(input: {
  userId: string;
  amount: number;
  projectId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): Promise<DeductionResult> {
  const { data, error } = await serviceClient().rpc("deduct_credits", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_project_id: input.projectId,
    p_model: input.model,
    p_input_tokens: input.inputTokens,
    p_output_tokens: input.outputTokens,
    p_cost_usd: input.costUsd,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) throw new Error(`credit deduction failed: ${error?.code ?? "no result"}`);
  return {
    charged: Number(row.charged),
    balanceAfter: Number(row.balance_after),
    shortfall: Number(row.shortfall),
  };
}

export async function creditsSpentToday(userId: string): Promise<number> {
  const { data, error } = await serviceClient().rpc("credits_spent_today", { p_user_id: userId });
  if (error) throw new Error(`spend lookup failed: ${error.code ?? "unknown"}`);
  return Number(data ?? 0);
}

// Assistant messages are written only here, by the server, after the project has been verified as
// the caller's. RLS lets users insert only their own "user" messages, so a client cannot forge one.
export async function insertAssistantMessage(input: {
  /** Chosen by the route before streaming, so the browser's live message and this row share an id. */
  id?: string;
  projectId: string;
  parts: unknown[];
}): Promise<void> {
  const { error } = await serviceClient()
    .from("messages")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      project_id: input.projectId,
      role: "assistant",
      parts: input.parts,
    });
  if (error) throw new Error(`assistant message write failed: ${error.code ?? "unknown"}`);
}

// Everything held about one account, as a single JSON document (data export).
export async function exportUserData(userId: string): Promise<unknown> {
  const { data, error } = await serviceClient().rpc("export_user_data", { p_user_id: userId });
  if (error) throw new Error(`export failed: ${error.code ?? "unknown"}`);
  return data;
}

// Deletes the sign-in account. Projects, files and messages cascade; the credit ledger and audit
// log are kept but anonymised by the database (see the init migration).
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await serviceClient().auth.admin.deleteUser(userId);
  if (error) throw new Error(`account deletion failed: ${error.code ?? error.status ?? "unknown"}`);
}

// Chat agent writes. Assistant replies and documents are never writable through the API.

export async function insertConversationAssistantMessage(input: {
  id: string;
  conversationId: string;
  parts: unknown[];
}): Promise<void> {
  const { error } = await serviceClient().from("conversation_messages").insert({
    id: input.id,
    conversation_id: input.conversationId,
    role: "assistant",
    parts: input.parts,
  });
  if (error) throw new Error(`assistant message write failed: ${error.code ?? "unknown"}`);
}

export async function insertConversationDocument(input: {
  conversationId: string;
  kind: "pptx" | "docx" | "pdf";
  title: string;
  spec: unknown;
}): Promise<{ id: string }> {
  const { data, error } = await serviceClient()
    .from("conversation_documents")
    .insert({
      conversation_id: input.conversationId,
      kind: input.kind,
      title: input.title,
      spec: input.spec,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`document write failed: ${error?.code ?? "no row"}`);
  return { id: data.id };
}

export async function touchConversation(id: string): Promise<void> {
  await serviceClient()
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
}

// Regenerate support. The newest reply is only looked up first (so it can be left out of the
// history the model sees) and is removed after its replacement has been saved, so a failed
// attempt never leaves the person without a reply. Only assistant replies are ever matched, so a
// person's own message cannot be removed this way. The caller has already verified ownership of
// the project or conversation through RLS.
const replyTable = (kind: "project" | "conversation") =>
  kind === "project"
    ? ({ table: "messages", column: "project_id" } as const)
    : ({ table: "conversation_messages", column: "conversation_id" } as const);

export async function newestReplyId(
  kind: "project" | "conversation",
  parentId: string,
): Promise<string | null> {
  const { table, column } = replyTable(kind);
  const { data, error } = await serviceClient()
    .from(table)
    .select("id, role")
    .eq(column, parentId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`reply lookup failed: ${error.code ?? "unknown"}`);
  const last = (data as Array<{ id: string; role: string }> | null)?.[0];
  return last && last.role === "assistant" ? last.id : null;
}

export async function deleteReply(
  kind: "project" | "conversation",
  parentId: string,
  replyId: string,
): Promise<void> {
  const { table, column } = replyTable(kind);
  const { error } = await serviceClient()
    .from(table)
    .delete()
    .eq("id", replyId)
    .eq(column, parentId)
    .eq("role", "assistant");
  if (error) throw new Error(`reply delete failed: ${error.code ?? "unknown"}`);
}
