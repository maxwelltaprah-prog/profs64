import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const REC = "22222222-2222-4222-8222-222222222222";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
const written = vi.hoisted(() => ({ calls: [] as string[] }));

// A minimal stand-in for the query builder: every call is recorded, every await resolves.
const builder = vi.hoisted(() => {
  const make = (): unknown =>
    new Proxy(() => undefined, {
      get: (_t, prop) => {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
        }
        if (prop === "single") {
          return async () => ({
            data: {
              id: "22222222-2222-4222-8222-222222222222",
              data: {},
              created_at: "a",
              updated_at: "b",
            },
            error: null,
          });
        }
        return (...args: unknown[]) => {
          written.calls.push(`${String(prop)}:${JSON.stringify(args)}`);
          return make();
        };
      },
    });
  return make;
});

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ from: () => builder() }),
}));
vi.mock("@/lib/db/projects", async (original) => ({ ...(await original()), getProject }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const headers = { origin: "https://app.example", host: "app.example" };
const call = async (
  method: "GET" | "POST" | "DELETE",
  collection: string,
  body?: string,
  extra: Record<string, string> = {},
  recordId?: string,
) => {
  const mod = recordId
    ? ((await import("@/app/api/projects/[id]/data/[collection]/[recordId]/route")) as never)
    : ((await import("@/app/api/projects/[id]/data/[collection]/route")) as never);
  const handler = (mod as Record<string, (r: Request, c: never) => Promise<Response>>)[method];
  if (!handler) throw new Error("no handler");
  return handler(
    new Request("https://app.example/x", {
      method,
      headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}), ...extra },
      ...(body ? { body } : {}),
    }),
    { params: Promise.resolve({ id: PROJECT, collection, recordId }) } as never,
  );
};

beforeEach(() => {
  vi.resetModules();
  written.calls.length = 0;
  getVerifiedUser.mockReset().mockResolvedValue({ id: "u1" });
  getProject.mockReset().mockResolvedValue({ id: PROJECT });
  enforceLimits.mockReset().mockResolvedValue(undefined);
});

describe("project data routes", () => {
  it("lists and creates for the owner", async () => {
    expect((await call("GET", "todos")).status).toBe(200);
    const created = await call("POST", "todos", JSON.stringify({ a: 1 }));
    expect(created.status).toBe(201);
    expect(written.calls.join(" ")).toContain('"project_id":"' + PROJECT + '"');
  });
  it("rejects bad collection names, arrays, oversize bodies and cross-origin posts", async () => {
    expect((await call("GET", "Bad Name")).status).toBe(400);
    expect((await call("GET", "../x")).status).toBe(400);
    expect((await call("POST", "todos", "[1]")).status).toBe(422);
    expect((await call("POST", "todos", JSON.stringify({ x: "y".repeat(17000) }))).status).toBe(
      422,
    );
    expect((await call("POST", "todos", "{}", { origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect(written.calls).toEqual([]);
  });
  it("is a 404 when the project is not the caller's", async () => {
    getProject.mockRejectedValue(Object.assign(new Error("nf"), { status: 404 }));
    expect((await call("GET", "todos")).status).not.toBe(200);
    expect(written.calls).toEqual([]);
  });
  it("rejects a record id that is not a uuid and deletes a real one", async () => {
    expect((await call("DELETE", "todos", undefined, {}, "../etc")).status).toBe(404);
    expect((await call("DELETE", "todos", undefined, {}, REC)).status).toBe(204);
  });
});
