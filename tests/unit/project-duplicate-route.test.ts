import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const getVerifiedUser = vi.hoisted(() => vi.fn());
const duplicateProject = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/audit", () => ({ auditBestEffort: async () => undefined }));
vi.mock("@/lib/db/projects", async (original) => ({ ...(await original()), duplicateProject }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const call = async (origin = "https://app.example") => {
  const { POST } = (await import("@/app/api/projects/[id]/duplicate/route")) as {
    POST: (request: Request, context: never) => Promise<Response>;
  };
  return POST(
    new Request(`https://app.example/api/projects/${PROJECT}/duplicate`, {
      method: "POST",
      headers: { origin, host: "app.example" },
    }),
    { params: Promise.resolve({ id: PROJECT }) } as never,
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [getVerifiedUser, duplicateProject, enforceLimits]) fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  enforceLimits.mockResolvedValue(undefined);
  duplicateProject.mockResolvedValue({ id: "new", name: "A (copy)", updatedAt: "" });
});

describe("POST /api/projects/[id]/duplicate", () => {
  it("copies the project for the signed-in owner", async () => {
    const response = await call();
    expect(response.status).toBe(201);
    expect(duplicateProject).toHaveBeenCalledWith("user-1", PROJECT);
  });

  it("is a 404 for someone else's project", async () => {
    const errors = await import("@/lib/security/errors");
    duplicateProject.mockRejectedValue(errors.notFound());
    expect((await call()).status).toBe(404);
  });

  it("rejects other origins and signed-out callers", async () => {
    expect((await call("https://evil.example")).status).toBe(403);
    const errors = await import("@/lib/security/errors");
    getVerifiedUser.mockRejectedValue(errors.unauthenticated());
    expect((await call()).status).toBe(401);
    expect(duplicateProject).not.toHaveBeenCalled();
  });
});
