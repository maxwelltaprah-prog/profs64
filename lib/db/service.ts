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

export interface DeductionResult {
  charged: number;
  balanceAfter: number;
  shortfall: number;
}

export async function deductCredits(input: {
  userId: string;
  amount: number;
  projectId: string;
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
