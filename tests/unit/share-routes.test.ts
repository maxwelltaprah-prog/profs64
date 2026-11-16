import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT = "11111111-1111-4111-8111-111111111111";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const enableShare = vi.hoisted(() => vi.fn());
const disableShare = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/projects", async (original) => ({ ...(await original()), getProject }));
vi.mock("@/lib/db/share", () => ({ enableShare, disableShare }));
vi.mock("@/lib/db/supabase-server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

type Handler = (request: Request, context: never) => Promise<Response>;
const headers = { origin: "https://app.example", host: "app.example" };
const ctx = { params: Promise.resolve({ id: PROJECT }) } as never;
const errors = () => import("@/lib/security/errors");

const post = async () => {
  const { POST } = (await import("@/app/api/projects/[id]/share/route")) as { POST: Handler };
  return POST(
    new Request(`https://app.example/api/projects/${PROJECT}/share`, { method: "POST", headers }),
    ctx,
  );
};
const del = async () => {
  const { DELETE } = (await import("@/app/api/projects/[id]/share/route")) as { DELETE: Handler };
  return DELETE(
    new Request(`https://app.example/api/projects/${PROJECT}/share`, { method: "DELETE", headers }),
    ctx,
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [getVerifiedUser, getProject, enableShare, disableShare, enforceLimits])
    fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  getProject.mockResolvedValue({ id: PROJECT });
  enforceLimits.mockResolvedValue(undefined);
  enableShare.mockResolvedValue("abc123def456abc123def456abc12345");
  disableShare.mockResolvedValue(undefined);
});

describe("POST /api/projects/[id]/share", () => {
  it("returns the public slug and path for an owned project", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      slug: "abc123def456abc123def456abc12345",
      path: "/p/abc123def456abc123def456abc12345",
    });
  });

  it("404s for another's project, 401 without sign-in, 429 when rate limited", async () => {
    getProject.mockRejectedValue((await errors()).notFound());
    expect((await post()).status).toBe(404);
    getProject.mockResolvedValue({ id: PROJECT });
    getVerifiedUser.mockRejectedValue((await errors()).unauthenticated());
    expect((await post()).status).toBe(401);
    getVerifiedUser.mockResolvedValue({ id: "user-1" });
    enforceLimits.mockRejectedValue((await errors()).rateLimited(10));
    expect((await post()).status).toBe(429);
    expect(enableShare).not.toHaveBeenCalled();
  });

  it("surfaces a clear 409 when sharing is not available (pre-migration)", async () => {
    const { AppError } = await errors();
    enableShare.mockRejectedValue(
      new AppError(409, "sharing_unavailable", "Sharing isn't available yet."),
    );
    const response = await post();
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("sharing_unavailable");
  });
});

describe("DELETE /api/projects/[id]/share", () => {
  it("stops sharing an owned project", async () => {
    expect((await del()).status).toBe(204);
    expect(disableShare).toHaveBeenCalled();
    getProject.mockRejectedValue((await errors()).notFound());
    expect((await del()).status).toBe(404);
  });
});
