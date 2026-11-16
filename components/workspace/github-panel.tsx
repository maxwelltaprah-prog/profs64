"use client";

import { Check, ExternalLink, GitBranch } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { iconProps } from "@/components/ui/icons";

export interface GitHubLink {
  repo: string;
  branch: string;
  lastPushedAt?: string;
  commitUrl?: string;
}

interface PushReply {
  repoUrl: string;
  branch: string;
  commitUrl: string;
  createdRepo: boolean;
  unchanged: boolean;
  fileCount: number;
}

const storageKey = (projectId: string) => `buildr:github:${projectId}`;

// Reads and writes the remembered repository for a project. Only the repository name, branch and
// last commit link are kept, in this browser. The token is never stored anywhere.
export function readGitHubLink(projectId: string): GitHubLink | null {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<GitHubLink>;
    if (typeof value.repo !== "string" || typeof value.branch !== "string") return null;
    const link: GitHubLink = { repo: value.repo, branch: value.branch };
    if (typeof value.lastPushedAt === "string") link.lastPushedAt = value.lastPushedAt;
    if (typeof value.commitUrl === "string") link.commitUrl = value.commitUrl;
    return link;
  } catch {
    return null;
  }
}

function saveGitHubLink(projectId: string, link: GitHubLink) {
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(link));
  } catch {
    // Storage can be unavailable; the form just will not be pre-filled next time.
  }
}

export function GitHubPanel({
  projectId,
  built,
  onPushed,
}: {
  projectId: string;
  built: boolean;
  onPushed?: () => void;
}) {
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [token, setToken] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PushReply | null>(null);
  const [last, setLast] = useState<GitHubLink | null>(null);

  useEffect(() => {
    const saved = readGitHubLink(projectId);
    /* eslint-disable react-hooks/set-state-in-effect -- restoring saved values after mount */
    if (saved) {
      setRepo(saved.repo);
      setBranch(saved.branch === "default" ? "" : saved.branch);
      setLast(saved);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [projectId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/github`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          repo: repo.trim(),
          ...(branch.trim() ? { branch: branch.trim() } : {}),
          create,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        (PushReply & { error?: { message?: string } }) | { error?: { message?: string } } | null;
      if (response.ok && body && "commitUrl" in body) {
        setResult(body);
        setToken("");
        const link: GitHubLink = {
          repo: repo
            .trim()
            .replace(/^https?:\/\/github\.com\//i, "")
            .replace(/\.git$/i, ""),
          branch: body.branch,
          lastPushedAt: new Date().toISOString(),
          commitUrl: body.commitUrl,
        };
        saveGitHubLink(projectId, link);
        setLast(link);
        onPushed?.();
      } else {
        setError(body?.error?.message ?? "Could not push to GitHub. Check the details.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex max-w-xl flex-col gap-4">
      <p className="text-muted text-[13px] leading-5">
        Send this project&apos;s files to a GitHub repository as one commit. From there you can
        deploy it on Vercel, Netlify or Cloudflare Pages, or keep working in your own editor. Files
        already in the repository are kept; files you delete here are not removed there.
      </p>

      {last?.commitUrl ? (
        <p className="text-muted text-[13px]">
          Last push to <span className="text-text font-mono">{last.repo}</span>:{" "}
          <a
            href={last.commitUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-4"
          >
            view the commit
          </a>
        </p>
      ) : null}

      <Field
        label="Repository"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        placeholder="your-name/your-repo"
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={200}
      />
      <Field
        label="Branch"
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="Default branch"
        hint="Leave empty for the repository's default branch. A new branch is created if needed."
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
      />
      <Field
        label="Access token"
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={255}
        hint="Used for this push only. Buildr does not store it."
      />

      <label className="flex items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={create}
          onChange={(e) => setCreate(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          Create the repository if it does not exist
          <span className="text-muted block text-xs">
            Private, under the account the token belongs to.
          </span>
        </span>
      </label>

      <details className="border-hairline rounded-lg border px-3 py-2 text-[13px]">
        <summary className="cursor-pointer font-medium">How to get a token</summary>
        <ol className="text-muted mt-2 list-decimal space-y-1 pl-5 text-xs leading-5">
          <li>
            Open{" "}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              GitHub fine-grained tokens
            </a>{" "}
            and choose a short expiry.
          </li>
          <li>Under repository access, select only the repository you are pushing to.</li>
          <li>
            Give it Contents: Read and write. To let Buildr create the repository, use All
            repositories with Administration: Read and write instead.
          </li>
          <li>Paste the token above. Delete it on GitHub when you are done.</li>
        </ol>
      </details>

      {!built ? (
        <p className="text-muted text-[13px]">
          Nothing is built yet. Describe your app in the chat first, then push it.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy} disabled={!built || !repo.trim() || !token.trim()}>
          <GitBranch {...iconProps} />
          Push to GitHub
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-[13px]">
          {error}
        </p>
      ) : null}
      {result ? (
        <p
          role="status"
          className="border-hairline bg-surface-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-[13px]"
        >
          <Check {...iconProps} className="text-success" />
          {result.unchanged
            ? `Already up to date on ${result.branch}.`
            : `${result.createdRepo ? "Created the repository and pushed" : "Pushed"} ${result.fileCount} files to ${result.branch}.`}
          <a
            href={result.commitUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent inline-flex items-center gap-1 underline underline-offset-4"
          >
            Open on GitHub <ExternalLink {...iconProps} size={13} />
          </a>
        </p>
      ) : null}
    </form>
  );
}
