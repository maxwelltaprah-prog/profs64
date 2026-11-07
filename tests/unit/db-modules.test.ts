import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOptionalUser, getVerifiedUser } from "@/lib/db/auth";
import { hardenCookieOptions } from "@/lib/db/cookies";
import { getPublicEnv, getServiceEnv } from "@/lib/db/env";
import { creditsSpentToday, deductCredits, recordAuditEvent } from "@/lib/db/service";
import { AppError } from "@/lib/security/errors";

const rpc = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(() => ({ rpc })));
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

const URL_VAR = "http://127.0.0.1:54321";
const KEY_VAR = "x".repeat(40);
const SERVICE_KEY = "service-role-key-".padEnd(40, "s");

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_VAR);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", KEY_VAR);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
  rpc.mockReset();
  createClient.mockClear();
  getUser.mockReset();
});

describe("environment parsing", () => {
  it("returns validated values", () => {
    expect(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL).toBe(URL_VAR);
    expect(getServiceEnv().SUPABASE_SERVICE_ROLE_KEY).toBe(SERVICE_KEY);
  });

  it("names the broken variable but never prints values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url-secret-value");
    expect(() => getPublicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
    try {
      getPublicEnv();
    } catch (error) {
      expect(String(error)).not.toContain("not-a-url-secret-value");
    }
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "short");
    expect(() => getServiceEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("cookie hardening", () => {
  it("forces httpOnly, lax and path, and secure outside development", () => {
    expect(hardenCookieOptions({ httpOnly: false, sameSite: "none", maxAge: 100 }, true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 100,
    });
    expect(hardenCookieOptions(undefined, false)).toMatchObject({ httpOnly: true, secure: false });
  });
});

describe("verified user", () => {
  it("rejects anonymous callers with 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getVerifiedUser()).rejects.toMatchObject({ status: 401, code: "unauthenticated" });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "jwt expired" } });
    await expect(getVerifiedUser()).rejects.toBeInstanceOf(AppError);
    expect(await getOptionalUser()).toBeNull();
  });

  it("rejects unconfirmed email addresses with 403 before any AI use", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u", email_confirmed_at: null } },
      error: null,
    });
    await expect(getVerifiedUser()).rejects.toMatchObject({
      status: 403,
      code: "email_not_verified",
    });
  });

  it("returns confirmed users", async () => {
    const user = { id: "u", email_confirmed_at: "2026-01-01T00:00:00Z" };
    getUser.mockResolvedValue({ data: { user }, error: null });
    await expect(getVerifiedUser()).resolves.toEqual(user);
  });
});

describe("service-role operations", () => {
  it("creates the client with the service key and no session persistence", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await recordAuditEvent({ userId: "u", event: "login", requestId: "r" });
    expect(createClient).toHaveBeenCalledWith(URL_VAR, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(rpc).toHaveBeenCalledWith("record_audit_event", {
      p_user_id: "u",
      p_event: "login",
      p_metadata: {},
      p_request_id: "r",
    });
  });

  it("maps deduction results to numbers and passes every billing field", async () => {
    rpc.mockResolvedValue({
      data: [{ charged: "1.25", balance_after: "18.75", shortfall: "0.00" }],
      error: null,
    });
    const result = await deductCredits({
      userId: "u",
      amount: 1.25,
      projectId: "p",
      model: "m",
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.01,
    });
    expect(result).toEqual({ charged: 1.25, balanceAfter: 18.75, shortfall: 0 });
    expect(rpc).toHaveBeenCalledWith("deduct_credits", {
      p_user_id: "u",
      p_amount: 1.25,
      p_project_id: "p",
      p_model: "m",
      p_input_tokens: 10,
      p_output_tokens: 5,
      p_cost_usd: 0.01,
    });
  });

  it("fails loudly, without echoing database details, when the database errors", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "relation secret_table missing" },
    });
    const args = {
      userId: "u",
      amount: 1,
      projectId: "p",
      model: "m",
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
    };
    await expect(deductCredits(args)).rejects.toThrowError("credit deduction failed: XX000");
    await expect(deductCredits(args)).rejects.not.toThrowError(/secret_table/);
    await expect(creditsSpentToday("u")).rejects.toThrowError("spend lookup failed: XX000");
    await expect(recordAuditEvent({ userId: "u", event: "x" })).rejects.toThrowError(
      "audit write failed: XX000",
    );
  });

  it("treats an empty deduction result as a failure rather than a free request", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(
      deductCredits({
        userId: "u",
        amount: 1,
        projectId: "p",
        model: "m",
        inputTokens: 1,
        outputTokens: 1,
        costUsd: 0,
      }),
    ).rejects.toThrowError(/credit deduction failed/);
  });

  it("returns today's spend as a number", async () => {
    rpc.mockResolvedValue({ data: "2.50", error: null });
    expect(await creditsSpentToday("u")).toBe(2.5);
  });
});
