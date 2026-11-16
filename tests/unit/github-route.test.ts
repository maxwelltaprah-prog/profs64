import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const TOKEN = "github_pat_" + "A".repeat(30);

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const listProjectFiles = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
const pushToGitHub = vi.hoisted(() => vi.fn());
const auditBestEffort = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/audit", () => ({ auditBestEffort }));
vi.mock("@/lib/db/projects", async (original) => ({
  ...(await original()),
  getProject,
  listProjectFiles,
}));
vi.mock("@/lib/db/supabase-server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/github/push", async (original) => ({ ...(await original()), pushToGitHub }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const headers = {
  origin: "https://app.example",
  host: "app.example",
  "content-type": "application/json",
};
const ctx = { params: Promise.resolve({ id: PROJECT }) } as never;

const post = async (body: unknown) => {
  const { POST } = (await import("@/app/api/projects/[id]/github/route")) as {
    POST: (r: Request, c: never) => Promise<Response>;
  };
  return POST(
    new Request(`https://app.example/api/projects/${PROJECT}/github`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    ctx,
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [
    getVerifiedUser,
    getProject,
    listProjectFiles,
    enforceLimits,
    pushToGitHub,
    auditBestEffort,
  ])
    fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  getProject.mockResolvedValue({ id: PROJECT, name: "Cafe" });
  listProjectFiles.mockResolvedValue([{ path: "README.md", content: "# x" }]);
  enforceLimits.mockResolvedValue(undefined);
  pushToGitHub.mockResolvedValue({
    repoUrl: "r",
    fileCount: 1,
    createdRepo: false,
    unchanged: false,
  });
});

describe("POST /api/projects/[id]/github", () => {
  it("pushes the owner's files and audits without the token", async () => {
    const response = await post({ token: TOKEN, repo: "ada/site" });
    expect(response.status).toBe(200);
    expect(pushToGitHub).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "ada",
        repo: "site",
        create: false,
        files: [{ path: "README.md", content: "# x" }],
      }),
    );
    const audit = JSON.stringify(auditBestEffort.mock.calls);
    expect(audit).toContain("github_push");
    expect(audit).not.toContain(TOKEN);
  });

  it("rejects bad bodies and does not call GitHub", async () => {
    expect((await post({ token: "x", repo: "ada/site" })).status).toBe(422);
    expect((await post({ token: TOKEN, repo: "ada/site", extra: true })).status).toBe(422);
    expect(pushToGitHub).not.toHaveBeenCalled();
  });

  it("is a 404 for someone else's project and stops at the rate limit", async () => {
    const { notFound, rateLimited } = await import("@/lib/security/errors");
    getProject.mockRejectedValueOnce(notFound());
    expect((await post({ token: TOKEN, repo: "ada/site" })).status).toBe(404);
    expect(pushToGitHub).not.toHaveBeenCalled();
    enforceLimits.mockRejectedValueOnce(rateLimited(30));
    expect((await post({ token: TOKEN, repo: "ada/site" })).status).toBe(429);
  });

  it("refuses a request from another origin", async () => {
    const { POST } = (await import("@/app/api/projects/[id]/github/route")) as {
      POST: (r: Request, c: never) => Promise<Response>;
    };
    const response = await POST(
      new Request("https://app.example/x", {
        method: "POST",
        headers: { ...headers, origin: "https://evil.example" },
        body: JSON.stringify({ token: TOKEN, repo: "ada/site" }),
      }),
      ctx,
    );
    expect(response.status).toBe(403);
    expect(pushToGitHub).not.toHaveBeenCalled();
  });
});
