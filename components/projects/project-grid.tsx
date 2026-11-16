"use client";

import { Copy, ExternalLink, MoreVertical, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { coverVariant } from "@/lib/workspace/cover";

export interface ProjectCardItem {
  id: string;
  name: string;
  /** Already formatted on the server, e.g. "3 hours ago". */
  updatedLabel: string;
  pinned: boolean;
}

type Dialog = "rename" | "delete" | null;

const menuItem =
  "press text-text hover:bg-surface-2 focus-visible:bg-surface-2 flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px]";

function ProjectCard({
  project,
  pinsEnabled,
  onChanged,
}: {
  project: ProjectCardItem;
  pinsEnabled: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<Dialog>(null);
  const [draft, setDraft] = useState(project.name);
  const [busy, setBusy] = useState(false);

  // Close on an outside press or Escape, and move focus into the menu when it opens.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        wrapper.current?.querySelector<HTMLButtonElement>("[data-menu-trigger]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    wrapper.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (dialogKind && !element.open) element.showModal();
    if (!dialogKind && element.open) element.close();
  }, [dialogKind]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  const call = async (
    request: () => Promise<Response>,
    done: string,
    failed: string,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const response = await request();
      if (!response.ok) throw new Error("request failed");
      toast(done);
      onChanged();
      return true;
    } catch {
      toast(failed, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const name = draft.trim();
    if (!name || name === project.name) return setDialogKind(null);
    const ok = await call(
      () =>
        fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      "Project updated.",
      "Could not update the project.",
    );
    if (ok) setDialogKind(null);
  };

  const remove = async () => {
    const ok = await call(
      () => fetch(`/api/projects/${project.id}`, { method: "DELETE" }),
      "Project deleted.",
      "Could not delete the project.",
    );
    if (ok) setDialogKind(null);
  };

  return (
    <li className="card-hover lift border-hairline bg-surface group relative rounded-xl border">
      <Link
        href={`/project/${project.id}`}
        className="block rounded-xl focus-visible:outline-offset-0"
        aria-label={`Open ${project.name}`}
      >
        <div className={`cover cover-${coverVariant(project.id)} aspect-[16/9] rounded-t-xl`} />
        <div className="px-3.5 py-3 pr-12">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {project.pinned ? (
              <Pin size={12} className="text-accent shrink-0" aria-label="Pinned" />
            ) : null}
            <span className="truncate" title={project.name}>
              {project.name}
            </span>
          </p>
          <p className="text-muted mt-0.5 text-xs">Updated {project.updatedLabel}</p>
        </div>
      </Link>

      <div ref={wrapper} className="absolute right-2 bottom-2">
        <button
          type="button"
          data-menu-trigger
          aria-label={`Actions for ${project.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((current) => !current)}
          className="press text-muted hover:bg-surface-2 hover:text-text inline-flex size-8 items-center justify-center rounded-md"
        >
          <MoreVertical {...iconProps} />
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label={`${project.name} actions`}
            onKeyDown={moveFocus}
            className="menu-pop border-hairline-strong bg-surface absolute right-0 bottom-full z-10 mb-1 w-52 rounded-lg border p-1 shadow-md"
          >
            <Link role="menuitem" href={`/project/${project.id}`} className={menuItem}>
              <ExternalLink {...iconProps} /> Open
            </Link>
            {pinsEnabled ? (
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                onClick={() => {
                  setOpen(false);
                  void call(
                    () =>
                      fetch(`/api/projects/${project.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ pinned: !project.pinned }),
                      }),
                    project.pinned ? "Project unpinned." : "Project pinned to the top.",
                    "Could not change the pin.",
                  );
                }}
              >
                {project.pinned ? <PinOff {...iconProps} /> : <Pin {...iconProps} />}
                {project.pinned ? "Unpin" : "Pin to top"}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={menuItem}
              onClick={() => {
                setOpen(false);
                setDraft(project.name);
                setDialogKind("rename");
              }}
            >
              <Pencil {...iconProps} /> Edit details
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItem}
              onClick={() => {
                setOpen(false);
                void call(
                  () => fetch(`/api/projects/${project.id}/duplicate`, { method: "POST" }),
                  "Copy created.",
                  "Could not duplicate the project.",
                );
              }}
            >
              <Copy {...iconProps} /> Duplicate
            </button>
            <div className="bg-border my-1 h-px" aria-hidden="true" />
            <button
              type="button"
              role="menuitem"
              className={`${menuItem} !text-danger`}
              onClick={() => {
                setOpen(false);
                setDialogKind("delete");
              }}
            >
              <Trash2 {...iconProps} /> Delete
            </button>
          </div>
        ) : null}
      </div>

      <dialog
        ref={dialog}
        aria-label={dialogKind === "delete" ? "Delete project" : "Edit project details"}
        onClose={() => setDialogKind(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setDialogKind(null);
        }}
        className="bg-surface border-hairline-strong text-text m-auto w-[min(420px,calc(100vw-2rem))] rounded-xl border p-5 shadow-md backdrop:bg-black/30"
      >
        {dialogKind === "delete" ? (
          <div>
            <h2 className="text-base font-semibold tracking-tight">Delete project</h2>
            <p className="text-muted mt-2 text-[13px] leading-5">
              “{project.name}” and its files and chat history will be deleted. This cannot be
              undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDialogKind(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
                Delete
              </Button>
            </div>
          </div>
        ) : dialogKind === "rename" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2 className="text-base font-semibold tracking-tight">Edit details</h2>
            <label htmlFor={`name-${menuId}`} className="text-muted mt-4 block text-[13px]">
              Project name
            </label>
            <input
              id={`name-${menuId}`}
              autoFocus
              value={draft}
              maxLength={80}
              onChange={(event) => setDraft(event.target.value)}
              className="ring-line-focus border-input bg-surface mt-1.5 h-9 w-full rounded-md border px-3 text-sm outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDialogKind(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={busy}>
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </dialog>
    </li>
  );
}

export function ProjectGrid({
  projects,
  pinsEnabled,
  empty,
}: {
  projects: readonly ProjectCardItem[];
  pinsEnabled: boolean;
  empty: string;
}) {
  const router = useRouter();
  if (projects.length === 0) {
    return (
      <p className="border-hairline-strong text-muted mt-3 rounded-xl border border-dashed p-6 text-[13px]">
        {empty}
      </p>
    );
  }
  return (
    <ul className="card-in mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          pinsEnabled={pinsEnabled}
          onChanged={() => router.refresh()}
        />
      ))}
    </ul>
  );
}
