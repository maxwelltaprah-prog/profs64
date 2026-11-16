import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT = "11111111-1111-4111-8111-111111111111";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const patchEq = vi.hoisted(() => vi.fn());
const deleteEq = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/projects", async (original) => ({
  ...(await original()),
  getProject,
}));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq: async () => patchEq() };
      },
      delete: () => ({ eq: async () => deleteEq() }),
    }),
  }),
}));

type Handler = (request: Request, context: never) => Promise<Response>;
const headers = {
  "content-type": "application/json",
  origin: "https://app.example",
  host: "app.example",
};
const ctx = { params: Promise.resolve({ id: PROJECT }) } as never;
const errors = () => import("@/lib/security/errors");

const patch = async (body: unknown) => {
  const { PATCH } = (await import("@/app/api/projects/[id]/route")) as { PATCH: Handler };
  return PATCH(
    new Request(`https://app.example/api/projects/${PROJECT}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    }),
    ctx,
  );
};
const del = async () => {
  const { DELETE } = (await import("@/app/api/projects/[id]/route")) as { DELETE: Handler };
  return DELETE(
    new Request(`https://app.example/api/projects/${PROJECT}`, { method: "DELETE", headers }),
    ctx,
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [getVerifiedUser, getProject, update, remove, patchEq, deleteEq]) fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  getProject.mockResolvedValue({ id: PROJECT, name: "p", updatedAt: "" });
  patchEq.mockResolvedValue({ error: null });
  deleteEq.mockResolvedValue({ error: null });
});

describe("PATCH /api/projects/[id]", () => {
  it("renames", async () => {
    expect((await patch({ name: "New name" })).status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: "New name" }));
  });

  it("pins and unpins with a timestamp or null", async () => {
    await patch({ pinned: true });
    expect(update.mock.calls[0]?.[0].pinned_at).toEqual(expect.any(String));
    vi.clearAllMocks();
    getProject.mockResolvedValue({ id: PROJECT });
    patchEq.mockResolvedValue({ error: null });
    await patch({ pinned: false });
    expect(update.mock.calls[0]?.[0].pinned_at).toBeNull();
  });

  it("rejects an empty body, bad names, extra keys and someone else's project", async () => {
    for (const body of [{}, { name: "" }, { name: "x".repeat(81) }, { color: "red" }]) {
      expect((await patch(body)).status, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
    }
    getProject.mockRejectedValue((await errors()).notFound());
    expect((await patch({ name: "x" })).status).toBe(404);
    getVerifiedUser.mockRejectedValue((await errors()).unauthenticated());
    expect((await patch({ name: "x" })).status).toBe(401);
  });
});

describe("DELETE /api/projects/[id]", () => {
  it("deletes an owned project and 404s for another's", async () => {
    expect((await del()).status).toBe(204);
    expect(deleteEq).toHaveBeenCalled();
    getProject.mockRejectedValue((await errors()).notFound());
    expect((await del()).status).toBe(404);
  });
});
