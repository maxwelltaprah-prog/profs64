import { beforeEach, describe, expect, it, vi } from "vitest";

import { isValidBranch, parseRepoInput, pushToGitHub } from "@/lib/github/push";
import { githubPushSchema } from "@/lib/security/schemas";

const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error("expected a value");
  return value;
};

const TOKEN = "github_pat_" + "A".repeat(30);
const SHA = "a".repeat(40);
const NEW_SHA = "b".repeat(40);

type Route = (init: { method: string; body: unknown; url: string }) => [number, unknown, Headers?];

function fakeFetch(route: Route) {
  const calls: Array<{ method: string; path: string; body: unknown; auth: string | null }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    expect(new URL(url).host).toBe("api.github.com");
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const headers = init.headers as Record<string, string>;
    calls.push({ method: String(init.method), path, body, auth: headers["Authorization"] ?? null });
    const [status, json, h] = route({ method: String(init.method), body, url: path });
    return new Response(JSON.stringify(json), h ? { status, headers: h } : { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const input = {
  token: TOKEN,
  owner: "ada",
  repo: "site",
  message: "Update",
  create: false,
  files: [
    { path: "README.md", content: "# Site" },
    { path: "src/App.tsx", content: "export {}" },
  ],
};

const happy: Route = ({ method, url }) => {
  if (method === "GET" && url === "/repos/ada/site")
    return [200, { default_branch: "main", permissions: { push: true } }];
  if (method === "GET" && url.includes("/git/ref/heads/main"))
    return [200, { object: { sha: SHA } }];
  if (method === "GET" && url.includes(`/git/commits/${SHA}`))
    return [200, { tree: { sha: "t".repeat(40) } }];
  if (method === "POST" && url.endsWith("/git/trees")) return [201, { sha: "n".repeat(40) }];
  if (method === "POST" && url.endsWith("/git/commits")) return [201, { sha: NEW_SHA }];
  if (method === "PATCH") return [200, {}];
  return [500, {}];
};

describe("parseRepoInput and isValidBranch", () => {
  it("accepts owner/repo and GitHub URLs, rejects everything else", () => {
    expect(parseRepoInput("ada/site")).toEqual({ owner: "ada", repo: "site" });
    expect(parseRepoInput("https://github.com/ada/site.git")).toEqual({
      owner: "ada",
      repo: "site",
    });
    expect(parseRepoInput(" https://github.com/ada/site/ ")).toEqual({
      owner: "ada",
      repo: "site",
    });
    for (const bad of [
      "",
      "ada",
      "ada/",
      "/site",
      "ada/..",
      "a b/c",
      "ada/site/extra",
      "-ada/x",
      "https://evil.com/ada/site",
    ])
      expect(parseRepoInput(bad)).toBeNull();
  });
  it("rejects unsafe branch names", () => {
    expect(isValidBranch("main")).toBe(true);
    expect(isValidBranch("feature/new-home")).toBe(true);
    for (const bad of ["", "../x", "a..b", "a//b", "x.lock", "-x", "a b", "end/", "a;b"])
      expect(isValidBranch(bad)).toBe(false);
  });
});

describe("githubPushSchema", () => {
  const ok = { token: TOKEN, repo: "ada/site" };
  it("accepts a minimal body and rejects extras and bad values", () => {
    expect(githubPushSchema.safeParse(ok).success).toBe(true);
    expect(githubPushSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(githubPushSchema.safeParse({ ...ok, token: "short" }).success).toBe(false);
    expect(githubPushSchema.safeParse({ ...ok, repo: "nope" }).success).toBe(false);
    expect(githubPushSchema.safeParse({ ...ok, branch: "../x" }).success).toBe(false);
    expect(githubPushSchema.safeParse({ ...ok, message: "a\nb" }).success).toBe(false);
  });
});

describe("pushToGitHub", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("commits on top of the branch with inline content and never forces", async () => {
    const { impl, calls } = fakeFetch(happy);
    const result = await pushToGitHub(input, impl);
    expect(result).toMatchObject({
      branch: "main",
      commitSha: NEW_SHA,
      commitUrl: `https://github.com/ada/site/commit/${NEW_SHA}`,
      unchanged: false,
      createdRepo: false,
      fileCount: 2,
    });
    const tree = must(calls.find((c) => c.path.endsWith("/git/trees")));
    expect(tree.body).toMatchObject({
      base_tree: "t".repeat(40),
      tree: [
        { path: "README.md", mode: "100644", type: "blob", content: "# Site" },
        { path: "src/App.tsx" },
      ],
    });
    const patch = must(calls.find((c) => c.method === "PATCH"));
    expect(patch.body).toEqual({ sha: NEW_SHA, force: false });
    expect(calls.every((c) => c.auth === `Bearer ${TOKEN}`)).toBe(true);
    log.mockRestore();
  });

  it("makes no commit when the repository already has these files", async () => {
    const { impl, calls } = fakeFetch((r) =>
      r.method === "POST" && r.url.endsWith("/git/trees")
        ? [201, { sha: "t".repeat(40) }]
        : happy(r),
    );
    const result = await pushToGitHub(input, impl);
    expect(result.unchanged).toBe(true);
    expect(calls.some((c) => c.path.endsWith("/git/commits"))).toBe(false);
  });

  it("creates a missing branch from the default branch", async () => {
    const { impl, calls } = fakeFetch((r) => {
      if (r.method === "GET" && r.url.includes("/git/ref/heads/dev")) return [404, {}];
      if (r.method === "POST" && r.url.endsWith("/git/refs")) return [201, {}];
      return happy(r);
    });
    await pushToGitHub({ ...input, branch: "dev" }, impl);
    expect(must(calls.find((c) => c.path.endsWith("/git/refs"))).body).toEqual({
      ref: "refs/heads/dev",
      sha: SHA,
    });
  });

  it("creates a private repository under the token's account and seeds an empty repo", async () => {
    let made = false;
    let seeded = false;
    const { impl, calls } = fakeFetch((r) => {
      if (r.method === "GET" && r.url === "/repos/ada/site" && !made) return [404, {}];
      if (r.method === "GET" && r.url === "/user") return [200, { login: "Ada" }];
      if (r.method === "POST" && r.url === "/user/repos") {
        made = true;
        return [201, { default_branch: "main", permissions: { push: true } }];
      }
      if (r.method === "GET" && r.url.includes("/git/ref/heads/main") && !seeded) return [409, {}];
      if (r.method === "PUT" && r.url.endsWith("/contents/README.md")) {
        seeded = true;
        return [201, {}];
      }
      return happy(r);
    });
    const result = await pushToGitHub({ ...input, create: true }, impl);
    expect(result.createdRepo).toBe(true);
    expect(must(calls.find((c) => c.path === "/user/repos")).body).toMatchObject({ private: true });
    expect(seeded).toBe(true);
  });

  it("refuses to create a repository under someone else's account", async () => {
    const { impl } = fakeFetch((r) =>
      r.url === "/user" ? [200, { login: "someone-else" }] : [404, {}],
    );
    await expect(pushToGitHub({ ...input, create: true }, impl)).rejects.toMatchObject({
      code: "github_create_elsewhere",
    });
  });

  it.each([
    [401, "github_token_rejected"],
    [403, "github_no_access"],
  ])("maps a %s reply to a safe message", async (status, code) => {
    const { impl } = fakeFetch(() => [status, { message: `bad ${TOKEN}` }]);
    const error = await pushToGitHub(input, impl).catch((e: Error) => e);
    expect(error).toMatchObject({ code });
    expect(String((error as Error).message)).not.toContain(TOKEN);
  });

  it("reports a missing repository, a read-only token and rate limits", async () => {
    await expect(pushToGitHub(input, fakeFetch(() => [404, {}]).impl)).rejects.toMatchObject({
      code: "github_repo_not_found",
    });
    await expect(
      pushToGitHub(
        input,
        fakeFetch(() => [200, { default_branch: "main", permissions: { push: false } }]).impl,
      ),
    ).rejects.toMatchObject({ code: "github_no_access" });
    await expect(
      pushToGitHub(
        input,
        fakeFetch(() => [403, {}, new Headers({ "x-ratelimit-remaining": "0" })]).impl,
      ),
    ).rejects.toMatchObject({ code: "github_rate_limited" });
  });

  it("reports a refused branch update as a conflict and a network failure as 502", async () => {
    const { impl } = fakeFetch((r) => (r.method === "PATCH" ? [422, {}] : happy(r)));
    await expect(pushToGitHub(input, impl)).rejects.toMatchObject({ code: "github_conflict" });
    const down = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    await expect(pushToGitHub(input, down)).rejects.toMatchObject({
      status: 502,
      code: "github_unreachable",
    });
  });
});
