import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as PasswordModule from "@/lib/security/password";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));
const getOptionalUser = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const breach = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/supabase-server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock("@/lib/db/auth", () => ({ getOptionalUser }));
vi.mock("@/lib/db/service", () => ({ recordAuditEvent }));
vi.mock("@/lib/security/password", async (original) => ({
  ...(await original<typeof PasswordModule>()),
  checkBreachedPassword: breach,
}));

const GOOD_PASSWORD = "a-long-enough-passphrase";

type Handler = (request: Request) => Promise<Response>;

const load = async (name: string): Promise<Handler> =>
  ((await import(`@/app/api/auth/${name}/route`)) as { POST: Handler }).POST;

const call = (
  handler: Handler,
  body: unknown,
  { ip = "9.9.9.9", headers = {} }: { ip?: string; headers?: Record<string, string> } = {},
) =>
  handler(
    new Request("https://app.example/api/auth/x", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.example",
        host: "app.example",
        "x-real-ip": ip,
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.resetModules();
  for (const fn of [...Object.values(auth), getOptionalUser, recordAuditEvent, breach])
    fn.mockReset();
  breach.mockResolvedValue("clean");
  auth.signUp.mockResolvedValue({ data: { user: { id: "u" }, session: null }, error: null });
  auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: "u", email_confirmed_at: "2026-01-01" } },
    error: null,
  });
  auth.signOut.mockResolvedValue({ error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  auth.updateUser.mockResolvedValue({ data: {}, error: null });
  recordAuditEvent.mockResolvedValue(undefined);
});

describe("POST /api/auth/signup", () => {
  it("accepts a valid signup with 202 and asks the user to check their email", async () => {
    const response = await call(await load("signup"), {
      email: "New@Example.com",
      password: GOOD_PASSWORD,
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "check_email" });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.com" }));
  });

  it("answers identically when Supabase hides that the account already exists", async () => {
    const handler = await load("signup");
    const fresh = await call(handler, { email: "a@example.com", password: GOOD_PASSWORD });
    const repeat = await call(handler, { email: "a@example.com", password: GOOD_PASSWORD });
    expect([fresh.status, await fresh.json()]).toEqual([repeat.status, await repeat.json()]);
  });

  it("blocks weak and breached passwords before contacting Supabase", async () => {
    const handler = await load("signup");
    expect((await call(handler, { email: "a@example.com", password: "short" })).status).toBe(422);
    expect(
      (await call(handler, { email: "someone@example.com", password: "someone-is-in-here" }))
        .status,
    ).toBe(422);
    breach.mockResolvedValue("breached");
    const breached = await call(handler, { email: "a@example.com", password: GOOD_PASSWORD });
    expect(breached.status).toBe(422);
    expect((await breached.json()).error.code).toBe("weak_password");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("proceeds when the breach service is unreachable", async () => {
    breach.mockResolvedValue("unknown");
    expect(
      (await call(await load("signup"), { email: "a@example.com", password: GOOD_PASSWORD }))
        .status,
    ).toBe(202);
  });

  it("does not leak Supabase error details", async () => {
    auth.signUp.mockResolvedValue({
      data: {},
      error: { code: "email_address_invalid", message: "internal detail xyz" },
    });
    const response = await call(await load("signup"), {
      email: "a@example.com",
      password: GOOD_PASSWORD,
    });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("xyz");
  });

  it("closes a session if Supabase returns one because confirmations are off", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: "u" }, session: { access_token: "t" } },
      error: null,
    });
    await call(await load("signup"), { email: "a@example.com", password: GOOD_PASSWORD });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("rate limits repeated signups from one address, but not other addresses", async () => {
    const handler = await load("signup");
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++)
      statuses.push(
        (await call(handler, { email: `u${i}@example.com`, password: GOOD_PASSWORD })).status,
      );
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429, 429]);
    const limited = await call(handler, { email: "z@example.com", password: GOOD_PASSWORD });
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(
      (await call(handler, { email: "z@example.com", password: GOOD_PASSWORD }, { ip: "8.8.8.8" }))
        .status,
    ).toBe(202);
  });

  it("rejects cross-origin, non-JSON, oversized and malformed requests", async () => {
    const handler = await load("signup");
    const ok = { email: "a@example.com", password: GOOD_PASSWORD };
    expect((await call(handler, ok, { headers: { origin: "https://evil.example" } })).status).toBe(
      403,
    );
    expect((await call(handler, ok, { headers: { "content-type": "text/plain" } })).status).toBe(
      415,
    );
    expect((await call(handler, { ...ok, pad: "x".repeat(5000) })).status).toBe(413);
    expect((await call(handler, "{broken")).status).toBe(400);
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("signs in, records an audit event and reports verification state", async () => {
    const response = await call(await load("login"), {
      email: "a@example.com",
      password: "whatever",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", emailVerified: true });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u", event: "login" }),
    );
  });

  it("gives the same 401 for every kind of failure, so accounts cannot be enumerated", async () => {
    const handler = await load("login");
    const bodies = [];
    for (const code of ["invalid_credentials", "email_not_confirmed", "user_not_found"]) {
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { code, message: `detail ${code}` },
      });
      const response = await call(
        handler,
        { email: "a@example.com", password: "x" },
        { ip: `7.7.7.${bodies.length}` },
      );
      expect(response.status).toBe(401);
      const body = await response.json();
      bodies.push({ ...body, error: { ...body.error, requestId: "-" } });
    }
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(JSON.stringify(bodies)).not.toContain("detail");
  });

  it("locks an account out after repeated failures regardless of source address", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "invalid_credentials" },
    });
    const handler = await load("login");
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push(
        (
          await call(
            handler,
            { email: "victim@example.com", password: "guess" },
            { ip: `5.5.5.${i}` },
          )
        ).status,
      );
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
    auth.signInWithPassword.mockClear();
    await call(handler, { email: "victim@example.com", password: "right" }, { ip: "5.5.5.200" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("still logs the user in when the audit write fails", async () => {
    recordAuditEvent.mockRejectedValue(new Error("audit down"));
    expect(
      (await call(await load("login"), { email: "a@example.com", password: "x" })).status,
    ).toBe(200);
  });

  it("rejects unexpected fields", async () => {
    expect(
      (await call(await load("login"), { email: "a@example.com", password: "x", admin: true }))
        .status,
    ).toBe(422);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns the same 202 whether or not the address exists or sending fails", async () => {
    const handler = await load("forgot-password");
    const ok = await call(handler, { email: "a@example.com" });
    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { code: "user_not_found", message: "nope" },
    });
    const failed = await call(handler, { email: "ghost@example.com" });
    expect([failed.status, (await failed.json()).status]).toEqual([ok.status, "check_email"]);
    expect(ok.status).toBe(202);
  });

  it("limits requests per address", async () => {
    const handler = await load("forgot-password");
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++)
      statuses.push(
        (await call(handler, { email: "same@example.com" }, { ip: `4.4.4.${i}` })).status,
      );
    expect(statuses).toEqual([202, 202, 202, 429, 429]);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("requires the recovery session", async () => {
    getOptionalUser.mockResolvedValue(null);
    expect((await call(await load("reset-password"), { password: GOOD_PASSWORD })).status).toBe(
      401,
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("applies the password policy and breach check", async () => {
    getOptionalUser.mockResolvedValue({ id: "u", email: "person@example.com" });
    const handler = await load("reset-password");
    expect((await call(handler, { password: "person-is-here-123" })).status).toBe(422);
    breach.mockResolvedValue("breached");
    expect((await call(handler, { password: GOOD_PASSWORD })).status).toBe(422);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and audits it", async () => {
    getOptionalUser.mockResolvedValue({ id: "u", email: "person@example.com" });
    const response = await call(await load("reset-password"), { password: GOOD_PASSWORD });
    expect(response.status).toBe(200);
    expect(auth.updateUser).toHaveBeenCalledWith({ password: GOOD_PASSWORD });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "password_changed" }),
    );
  });
});

describe("POST /api/auth/logout", () => {
  it("signs out and audits when a user was signed in, and still succeeds when not", async () => {
    const handler = await load("logout");
    getOptionalUser.mockResolvedValue({ id: "u" });
    expect((await call(handler, {})).status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "logout" }));
    recordAuditEvent.mockClear();
    getOptionalUser.mockResolvedValue(null);
    expect((await call(handler, {})).status).toBe(200);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refuses cross-site logout", async () => {
    expect(
      (await call(await load("logout"), {}, { headers: { origin: "https://evil.example" } }))
        .status,
    ).toBe(403);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
