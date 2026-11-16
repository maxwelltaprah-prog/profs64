"use client";

import { Pencil, Pin, PinOff, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { type LibraryItem } from "@/lib/db/library";
import { cn } from "@/lib/utils/cn";

type Kind = "project" | "chat";

const endpoint = (kind: Kind, id: string) =>
  kind === "project" ? `/api/projects/${id}` : `/api/conversations/${id}`;
const href = (kind: Kind, id: string) => (kind === "project" ? `/project/${id}` : `/chat/${id}`);
const titleKey = (kind: Kind) => (kind === "project" ? "name" : "title");

const timeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function ItemRow({
  kind,
  item,
  pinsEnabled,
  onChanged,
}: {
  kind: Kind;
  item: LibraryItem;
  pinsEnabled: boolean;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [draft, setDraft] = useState(item.title);
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const response = await fetch(endpoint(kind, item.id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) onChanged();
    } finally {
      setBusy(false);
      setMode("view");
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch(endpoint(kind, item.id), { method: "DELETE" });
      if (response.ok) onChanged();
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const name = draft.trim();
    if (!name || name === item.title) {
      setMode("view");
      return;
    }
    void patch({ [titleKey(kind)]: name });
  };

  return (
    <li className="border-hairline flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
      {item.pinned ? <Pin size={13} className="text-accent shrink-0" aria-label="Pinned" /> : null}
      {mode === "rename" ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="sr-only" htmlFor={`rename-${item.id}`}>
            Rename
          </label>
          <input
            id={`rename-${item.id}`}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={kind === "project" ? 80 : 120}
            className="ring-line-focus border-input bg-surface min-w-0 flex-1 rounded-md border px-2.5 py-1 text-[13px] outline-none"
          />
          <Button type="submit" size="sm" loading={busy}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
            Cancel
          </Button>
        </form>
      ) : mode === "confirm" ? (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="text-[13px]">Delete “{item.title}”? This cannot be undone.</span>
          <span className="flex shrink-0 gap-2">
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("view")}>
              Cancel
            </Button>
          </span>
        </div>
      ) : (
        <>
          <Link
            href={href(kind, item.id)}
            className="min-w-0 flex-1 truncate text-[13px] font-medium hover:underline"
            title={item.title}
          >
            {item.title}
          </Link>
          <span className="text-subtle hidden shrink-0 text-xs tabular-nums sm:block">
            {timeFormat.format(new Date(item.updatedAt))}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {pinsEnabled ? (
              <button
                type="button"
                aria-label={item.pinned ? "Unpin" : "Pin"}
                title={item.pinned ? "Unpin" : "Pin"}
                disabled={busy}
                onClick={() => void patch({ pinned: !item.pinned })}
                className="press text-subtle hover:text-text hover:bg-surface-2 inline-flex size-7 items-center justify-center rounded-md disabled:opacity-50"
              >
                {item.pinned ? <PinOff {...iconProps} /> : <Pin {...iconProps} />}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Rename"
              title="Rename"
              onClick={() => {
                setDraft(item.title);
                setMode("rename");
              }}
              className="press text-subtle hover:text-text hover:bg-surface-2 inline-flex size-7 items-center justify-center rounded-md"
            >
              <Pencil {...iconProps} />
            </button>
            <button
              type="button"
              aria-label="Delete"
              title="Delete"
              onClick={() => setMode("confirm")}
              className="press text-subtle hover:text-danger hover:bg-surface-2 inline-flex size-7 items-center justify-center rounded-md"
            >
              <Trash2 {...iconProps} />
            </button>
          </span>
        </>
      )}
    </li>
  );
}

function Section({
  title,
  kind,
  items,
  pinsEnabled,
  query,
  onChanged,
  empty,
}: {
  title: string;
  kind: Kind;
  items: LibraryItem[];
  pinsEnabled: boolean;
  query: string;
  onChanged: () => void;
  empty: string;
}) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((i) => i.title.toLowerCase().includes(needle)) : items;
  }, [items, query]);

  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-subtle text-xs tabular-nums">{filtered.length}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-muted border-hairline-strong mt-3 rounded-xl border border-dashed p-5 text-[13px]">
          {query.trim() ? "No matches." : empty}
        </p>
      ) : (
        <ul className="border-hairline bg-surface mt-3 overflow-hidden rounded-xl border">
          {filtered.map((item) => (
            <ItemRow
              key={item.id}
              kind={kind}
              item={item}
              pinsEnabled={pinsEnabled}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function LibraryView({
  projects,
  chats,
  pinsEnabled,
}: {
  projects: LibraryItem[];
  chats: LibraryItem[];
  pinsEnabled: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-8">
      <label className="ring-line-focus border-input bg-surface flex h-10 max-w-md items-center gap-2 rounded-lg border px-3">
        <Search {...iconProps} className="text-subtle shrink-0" />
        <span className="sr-only">Search your projects and chats</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects and chats"
          className="placeholder:text-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="text-subtle hover:text-text"
          >
            <X {...iconProps} />
          </button>
        ) : null}
      </label>

      {!pinsEnabled ? (
        <p className={cn("text-muted border-hairline rounded-lg border px-3 py-2 text-[13px]")}>
          Pinning becomes available once the latest database update is applied.
        </p>
      ) : null}

      <Section
        title="Projects"
        kind="project"
        items={projects}
        pinsEnabled={pinsEnabled}
        query={query}
        onChanged={refresh}
        empty="No projects yet."
      />
      <Section
        title="Chats"
        kind="chat"
        items={chats}
        pinsEnabled={pinsEnabled}
        query={query}
        onChanged={refresh}
        empty="No chats yet."
      />
    </div>
  );
}
