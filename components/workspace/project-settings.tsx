"use client";

import {
  Check,
  Copy,
  Globe,
  GitBranch,
  Info,
  Link2,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { iconProps } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

import { GitHubPanel, readGitHubLink, type GitHubLink } from "./github-panel";
import { SharePanel } from "./share-button";

export type SettingsSection = "details" | "sharing" | "github" | "domains" | "danger";

const NAV: Array<{ id: SettingsSection; label: string; Icon: LucideIcon; group: string }> = [
  { id: "details", label: "Project details", Icon: Info, group: "General" },
  { id: "sharing", label: "Sharing", Icon: Link2, group: "General" },
  { id: "domains", label: "Domains", Icon: Globe, group: "General" },
  { id: "github", label: "GitHub", Icon: GitBranch, group: "Build" },
  { id: "danger", label: "Delete project", Icon: Trash2, group: "Danger zone" },
];

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-medium">{label}</p>
      {children}
      {hint ? <p className="text-muted text-xs">{hint}</p> : null}
    </div>
  );
}

function ReadOnly({ children }: { children: ReactNode }) {
  return (
    <p className="border-hairline bg-surface-2 text-muted flex min-h-9 items-center rounded-md border px-3 text-sm break-all">
      {children}
    </p>
  );
}

function StatusCard({
  step,
  title,
  status,
  text,
  onClick,
}: {
  step: string;
  title: string;
  status: string;
  text: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "border-hairline bg-surface flex flex-col gap-1 rounded-lg border p-3 text-left",
        onClick && "press hover:bg-surface-2",
      )}
    >
      <span className="text-subtle flex items-center justify-between text-[11px] tracking-wide uppercase">
        {step}
        <span className="border-hairline text-muted rounded-full border px-2 py-0.5 text-[11px] normal-case">
          {status}
        </span>
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-muted text-xs leading-5">{text}</span>
    </Tag>
  );
}

function DetailsSection({
  projectId,
  name,
  createdAt,
  ownerEmail,
  built,
  shared,
  go,
}: {
  projectId: string;
  name: string;
  createdAt: string | null;
  ownerEmail: string;
  built: boolean;
  shared: boolean;
  go: (section: SettingsSection) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [link, setLink] = useState<GitHubLink | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only values read after mount */
    setOrigin(window.location.origin);
    setLink(readGitHubLink(projectId));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [projectId]);

  const url = `${origin}/project/${projectId}`;
  const dirty = draft.trim() !== name && draft.trim().length > 0;

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: draft.trim() }),
      });
      if (response.ok) {
        setSaved(true);
        router.refresh();
      } else {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not save the name. Try again.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the link is visible and selectable.
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty) void save();
        }}
      >
        <Field
          label="Project name"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          maxLength={80}
          hint="Shown in the header and in your library."
          className="flex-1"
        />
        <Button type="submit" variant="secondary" loading={busy} disabled={!dirty} className="mb-6">
          {saved ? <Check {...iconProps} /> : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-danger -mt-3 text-[13px]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Owner" hint="Your role: owner">
          <ReadOnly>{ownerEmail}</ReadOnly>
        </Row>
        <Row label="Created">
          <ReadOnly>{createdAt ? dateFormat.format(new Date(createdAt)) : "Unknown"}</ReadOnly>
        </Row>
      </div>

      <Row label="Project link" hint="Opens this project for you. Only you can open it.">
        <div className="flex items-center gap-2">
          <ReadOnly>{url}</ReadOnly>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Copy project link"
            onClick={() => void copy()}
          >
            {copied ? <Check {...iconProps} /> : <Copy {...iconProps} />}
          </Button>
        </div>
      </Row>

      <section aria-label="Launch path" className="border-hairline rounded-xl border p-4">
        <h3 className="text-sm font-semibold tracking-tight">Your launch path</h3>
        <p className="text-muted mt-0.5 text-xs">What is done and what is still waiting on you.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatusCard
            step="01 · Build"
            title="Describe your app"
            status={built ? "Built" : "Not started"}
            text={
              built
                ? "The assistant has written files for this project."
                : "Tell the assistant what to make in the chat."
            }
          />
          <StatusCard
            step="02 · Share"
            title="Public preview"
            status={shared ? "Shared" : "Private"}
            text="A read-only link anyone can open, without an account."
            onClick={() => go("sharing")}
          />
          <StatusCard
            step="03 · Export"
            title="GitHub"
            status={link?.lastPushedAt ? "Pushed" : "Not pushed"}
            text={
              link?.lastPushedAt
                ? `Last pushed to ${link.repo} on ${dateFormat.format(new Date(link.lastPushedAt))}.`
                : "Push the code to a repository you own."
            }
            onClick={() => go("github")}
          />
          <StatusCard
            step="04 · Address"
            title="Custom domain"
            status="Planned"
            text="Hosting and domains are not available yet."
            onClick={() => go("domains")}
          />
        </div>
      </section>
    </div>
  );
}

function DangerSection({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setError("Could not delete the project. Try again.");
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="border-danger/40 flex max-w-xl flex-col gap-3 rounded-xl border p-4">
      <h3 className="text-sm font-semibold tracking-tight">Delete this project</h3>
      <p className="text-muted text-[13px] leading-5">
        Deletes “{name}”, its files, its chat and its public link. This cannot be undone. A copy on
        GitHub is not affected.
      </p>
      {confirm ? (
        <div className="flex items-center gap-2">
          <Button variant="danger" loading={busy} onClick={() => void remove()}>
            Delete permanently
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setConfirm(true)}>
          <Trash2 {...iconProps} />
          Delete this project
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-danger text-[13px]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// A large settings dialog in the style of a project settings page: a section list on the left (a
// scrolling tab row on phones) and the chosen section on the right. Native <dialog> gives focus
// trapping and Escape. Everything shown here is real: nothing is listed that does not work, and
// planned items are labelled as planned.
export function ProjectSettings({
  open,
  section,
  onSectionChange,
  onClose,
  projectId,
  name,
  createdAt,
  ownerEmail,
  built,
  shareSlug,
  shareAvailable,
}: {
  open: boolean;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onClose: () => void;
  projectId: string;
  name: string;
  createdAt: string | null;
  ownerEmail: string;
  built: boolean;
  shareSlug: string | null;
  shareAvailable: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const currentLabel = NAV.find((item) => item.id === section)?.label ?? "Project details";
  const groups = [...new Set(NAV.map((item) => item.group))];

  return (
    <dialog
      ref={dialog}
      aria-label="Project settings"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      className="bg-surface border-hairline-strong text-text m-auto h-dvh max-h-dvh w-screen max-w-none overflow-hidden border-0 p-0 shadow-md backdrop:bg-black/40 md:h-[min(680px,calc(100dvh-2rem))] md:w-[min(980px,calc(100vw-2rem))] md:rounded-xl md:border"
    >
      {open ? (
        <div className="flex h-full flex-col md:flex-row">
          <nav
            aria-label="Settings sections"
            className="border-hairline bg-surface-2/50 shrink-0 border-b md:w-60 md:border-r md:border-b-0"
          >
            <p className="text-sm font-semibold tracking-tight max-md:hidden md:px-4 md:pt-4 md:pb-2">
              Project settings
            </p>
            <div className="flex gap-1 overflow-x-auto p-2 md:flex-col md:gap-0 md:overflow-visible md:px-2 md:pb-4">
              {groups.map((group) => (
                <div key={group} className="flex gap-1 md:mt-3 md:flex-col md:gap-0.5">
                  <p className="text-subtle px-2 pb-1 text-[11px] tracking-wide uppercase max-md:hidden">
                    {group}
                  </p>
                  {NAV.filter((item) => item.group === group).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-current={section === id ? "page" : undefined}
                      onClick={() => onSectionChange(id)}
                      className={cn(
                        "press flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-[13px] whitespace-nowrap",
                        section === id
                          ? "bg-surface text-text shadow-sm"
                          : "text-muted hover:bg-surface hover:text-text",
                      )}
                    >
                      <Icon {...iconProps} />
                      {label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="border-hairline flex h-12 shrink-0 items-center justify-between border-b px-4">
              <h2 className="text-sm font-semibold tracking-tight">{currentLabel}</h2>
              <Button variant="ghost" size="icon" aria-label="Close settings" onClick={onClose}>
                <X {...iconProps} />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              {section === "details" ? (
                <DetailsSection
                  key={name}
                  projectId={projectId}
                  name={name}
                  createdAt={createdAt}
                  ownerEmail={ownerEmail}
                  built={built}
                  shared={Boolean(shareSlug)}
                  go={onSectionChange}
                />
              ) : null}
              {section === "sharing" ? (
                <div className="max-w-xl">
                  <p className="text-muted mb-4 text-[13px] leading-5">
                    Anyone with the link can open a read-only preview of this project&apos;s app.
                    They cannot see your chat, files or account.
                  </p>
                  <SharePanel
                    projectId={projectId}
                    initialSlug={shareSlug}
                    available={shareAvailable}
                  />
                </div>
              ) : null}
              {section === "github" ? <GitHubPanel projectId={projectId} built={built} /> : null}
              {section === "domains" ? (
                <div className="flex max-w-xl flex-col gap-3 text-[13px] leading-5">
                  <p className="border-hairline bg-surface-2 text-muted w-fit rounded-full border px-2.5 py-0.5 text-xs">
                    Planned
                  </p>
                  <p>
                    Hosting and custom domains are not available yet. Your app runs in the preview
                    and in the public preview link.
                  </p>
                  <p className="text-muted">
                    To put it on your own address today, push the code to GitHub and deploy it on
                    Vercel, Netlify or Cloudflare Pages, which can connect a domain you own. You can
                    also download the codebase from the Code tab.
                  </p>
                </div>
              ) : null}
              {section === "danger" ? <DangerSection projectId={projectId} name={name} /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
