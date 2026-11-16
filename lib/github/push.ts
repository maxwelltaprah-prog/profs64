import { AppError } from "@/lib/security/errors";

// Pushes a project's files to a GitHub repository with the REST "git data" API: one tree, one
// commit, one ref update. Only api.github.com is ever called. The access token comes with each
// request, is used for these calls and is never stored, logged or returned.
//
// Non-destructive by design: the new tree is built on top of the branch's current tree, so files
// that exist in the repository but not in the project (a LICENSE, say) are kept. Files removed from
// the project are therefore not removed from the repository.

const API = "https://api.github.com";
const TIMEOUT_MS = 10_000;

export interface PushFile {
  path: string;
  content: string;
}

export interface PushInput {
  token: string;
  owner: string;
  repo: string;
  /** Defaults to the repository's default branch. Created from it when missing. */
  branch?: string | undefined;
  message: string;
  files: readonly PushFile[];
  /** Create the repository (private) under the token's own account when it does not exist. */
  create: boolean;
}

export interface PushResult {
  repoUrl: string;
  branch: string;
  commitSha: string;
  commitUrl: string;
  createdRepo: boolean;
  /** True when the repository already had exactly these files, so no commit was made. */
  unchanged: boolean;
  fileCount: number;
}

type Json = Record<string, unknown>;
interface Reply {
  status: number;
  body: Json;
  rateLimited: boolean;
}

const fail = (status: number, code: string, message: string) => new AppError(status, code, message);

export function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const trimmed = raw
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(trimmed);
  const owner = match?.[1];
  const repo = match?.[2];
  if (!owner || !repo || repo === "." || repo === "..") return null;
  return { owner, repo };
}

export function isValidBranch(branch: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(branch) &&
    !branch.includes("..") &&
    !branch.includes("//") &&
    !branch.endsWith("/") &&
    !branch.endsWith(".lock") &&
    !branch.endsWith(".")
  );
}

const refPath = (branch: string) => branch.split("/").map(encodeURIComponent).join("/");
const bytesToBase64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

export async function pushToGitHub(
  input: PushInput,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const { owner, repo } = input;
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const call = async (method: string, path: string, payload?: unknown): Promise<Reply> => {
    let response: Response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${input.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Buildr",
          ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: payload === undefined ? null : JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw fail(502, "github_unreachable", "Could not reach GitHub. Try again in a moment.");
    }
    const body = (await response.json().catch(() => ({}))) as Json;
    return {
      status: response.status,
      body: body && typeof body === "object" ? body : {},
      rateLimited:
        response.status === 429 ||
        (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0"),
    };
  };

  // Turns an unexpected GitHub reply into a message that says what to change.
  const unexpected = (reply: Reply, step: string): AppError => {
    if (reply.rateLimited)
      return fail(429, "github_rate_limited", "GitHub is rate limiting this token. Try later.");
    if (reply.status === 401)
      return fail(401, "github_token_rejected", "GitHub did not accept that token. Check it.");
    if (reply.status === 403 || reply.status === 404)
      return fail(
        403,
        "github_no_access",
        "The token cannot write to that repository. It needs Contents: read and write on it.",
      );
    if (reply.status === 409 || reply.status === 422)
      return fail(
        409,
        "github_conflict",
        `GitHub could not apply the change (${step}). The branch may be protected or have changed.`,
      );
    return fail(502, "github_error", `GitHub returned an error (${step}). Try again.`);
  };

  let createdRepo = false;
  let repoReply = await call("GET", base);
  if (repoReply.status === 404 && input.create) {
    const me = await call("GET", "/user");
    if (me.status === 401) throw unexpected(me, "token check");
    const login = typeof me.body["login"] === "string" ? me.body["login"] : "";
    if (me.status !== 200 || login.toLowerCase() !== owner.toLowerCase()) {
      throw fail(
        400,
        "github_create_elsewhere",
        "Buildr can only create repositories under the token's own account. Create it on GitHub first.",
      );
    }
    const made = await call("POST", "/user/repos", {
      name: repo,
      private: true,
      description: "Created from Buildr",
    });
    if (made.status !== 201) throw unexpected(made, "create repository");
    createdRepo = true;
    repoReply = made;
  }
  if (repoReply.status !== 200 && repoReply.status !== 201) {
    if (repoReply.status === 404)
      throw fail(
        404,
        "github_repo_not_found",
        "That repository was not found, or the token cannot see it. Check the name and the token.",
      );
    throw unexpected(repoReply, "find repository");
  }
  const permissions = repoReply.body["permissions"] as { push?: boolean } | undefined;
  if (permissions && permissions.push === false) {
    throw fail(
      403,
      "github_no_access",
      "The token can read that repository but not write to it. It needs Contents: read and write.",
    );
  }
  const defaultBranch =
    typeof repoReply.body["default_branch"] === "string"
      ? (repoReply.body["default_branch"] as string)
      : "main";
  const branch = input.branch ?? defaultBranch;
  const repoUrl = `https://github.com/${owner}/${repo}`;

  // An empty repository has no commit to build on, and the git data API refuses it, so the first
  // commit is made through the contents API.
  const defaultRef = await call("GET", `${base}/git/ref/heads/${refPath(defaultBranch)}`);
  if (defaultRef.status === 404 || defaultRef.status === 409) {
    const readme = input.files.find((file) => file.path === "README.md");
    const seeded = await call("PUT", `${base}/contents/README.md`, {
      message: "Initial commit",
      content: bytesToBase64(readme?.content ?? `# ${repo}\n`),
    });
    if (seeded.status !== 201 && seeded.status !== 200) throw unexpected(seeded, "first commit");
  } else if (defaultRef.status !== 200) {
    throw unexpected(defaultRef, "read branch");
  }

  let headSha: string;
  const branchRef = await call("GET", `${base}/git/ref/heads/${refPath(branch)}`);
  if (branchRef.status === 200) {
    headSha = String((branchRef.body["object"] as Json | undefined)?.["sha"] ?? "");
  } else if (branchRef.status === 404 && branch !== defaultBranch) {
    const from = await call("GET", `${base}/git/ref/heads/${refPath(defaultBranch)}`);
    if (from.status !== 200) throw unexpected(from, "read default branch");
    headSha = String((from.body["object"] as Json | undefined)?.["sha"] ?? "");
    const created = await call("POST", `${base}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: headSha,
    });
    if (created.status !== 201) throw unexpected(created, "create branch");
  } else {
    throw unexpected(branchRef, "read branch");
  }
  if (!/^[0-9a-f]{40}$/.test(headSha)) throw fail(502, "github_error", "GitHub returned an error.");

  const head = await call("GET", `${base}/git/commits/${headSha}`);
  if (head.status !== 200) throw unexpected(head, "read commit");
  const baseTree = String((head.body["tree"] as Json | undefined)?.["sha"] ?? "");

  const tree = await call("POST", `${base}/git/trees`, {
    base_tree: baseTree,
    tree: input.files.map((file) => ({
      path: file.path,
      mode: "100644",
      type: "blob",
      content: file.content,
    })),
  });
  if (tree.status !== 201) throw unexpected(tree, "write files");
  const treeSha = String(tree.body["sha"] ?? "");

  if (treeSha === baseTree) {
    return {
      repoUrl,
      branch,
      commitSha: headSha,
      commitUrl: `${repoUrl}/commit/${headSha}`,
      createdRepo,
      unchanged: true,
      fileCount: input.files.length,
    };
  }

  const commit = await call("POST", `${base}/git/commits`, {
    message: input.message,
    tree: treeSha,
    parents: [headSha],
  });
  if (commit.status !== 201) throw unexpected(commit, "write commit");
  const commitSha = String(commit.body["sha"] ?? "");

  // No force: if someone pushed in between, this is refused instead of overwriting their work.
  const moved = await call("PATCH", `${base}/git/refs/heads/${refPath(branch)}`, {
    sha: commitSha,
    force: false,
  });
  if (moved.status !== 200) throw unexpected(moved, "update branch");

  return {
    repoUrl,
    branch,
    commitSha,
    commitUrl: `${repoUrl}/commit/${commitSha}`,
    createdRepo,
    unchanged: false,
    fileCount: input.files.length,
  };
}
