import { beforeEach, describe, expect, it, vi } from "vitest";

const getOptionalUser = vi.hoisted(() => vi.fn());
const exportUserData = vi.hoisted(() => vi.fn());
const deleteAuthUser = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const signIn = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getOptionalUser }));
vi.mock("@/lib/db/service", () => ({ exportUserData, deleteAuthUser, recordAuditEvent }));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithPassword: signIn, signOut } }),
}));

type Handler = (request: Request) => Promise<Response>;

const headers = {
  "content-type": "application/json",
  origin: "https://app.example",
  host: "app.example",
};
const del = (body: unknown) =>
  new Request("https://app.example/api/account/delete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetModules();
  for (const fn of [
    getOptionalUser,
    exportUserData,
    deleteAuthUser,
    recordAuditEvent,
    signIn,
    signOut,
  ])
    fn.mockReset();
  getOptionalUser.mockResolvedValue({ id: "u1", email: "a@example.com" });
  signIn.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});

describe("GET /api/account/export", () => {
  const call = async () => {
    const { GET } = (await import("@/app/api/account/export/route")) as { GET: Handler };
    return GET(new Request("https://app.example/api/account/export"));
  };

  it("downloads the caller's own data and never accepts another id", async () => {
    exportUserData.mockResolvedValue({ profile: { id: "u1" }, projects: [] });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ profile: { id: "u1" }, projects: [] });
    expect(exportUserData).toHaveBeenCalledExactlyOnceWith("u1");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", event: "data_exported" }),
    );
  });

  it("requires a session", async () => {
    getOptionalUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(exportUserData).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    exportUserData.mockResolvedValue({});
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await call()).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
  });
});

describe("POST /api/account/delete", () => {
  const call = async (body: unknown) => {
    const { POST } = (await import("@/app/api/account/delete/route")) as { POST: Handler };
    return POST(del(body));
  };
  const good = { password: "correct horse battery", confirm: "delete my account" };

  it("re-checks the password, audits, deletes and signs out", async () => {
    const response = await call(good);
    expect(response.status).toBe(200);
    expect(signIn).toHaveBeenCalledWith({ email: "a@example.com", password: good.password });
    expect(deleteAuthUser).toHaveBeenCalledExactlyOnceWith("u1");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", event: "account_deleted" }),
    );
    expect(signOut).toHaveBeenCalled();
  });

  it("does nothing with a wrong password", async () => {
    signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const response = await call(good);
    expect(response.status).toBe(401);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it.each([
    ["no confirmation", { password: "x" }],
    ["wrong confirmation", { password: "x", confirm: "yes" }],
    ["no password", { confirm: "delete my account" }],
    ["a user id from the client", { ...good, userId: "someone-else" }],
  ])("rejects %s", async (_label, body) => {
    const response = await call(body);
    expect(response.status).toBe(422);
    expect(deleteAuthUser).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getOptionalUser.mockResolvedValue(null);
    expect((await call(good)).status).toBe(401);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("limits password guessing through this endpoint", async () => {
    signIn.mockResolvedValue({ error: { message: "bad" } });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await call(good)).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });
});
