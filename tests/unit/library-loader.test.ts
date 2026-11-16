import { describe, expect, it, vi } from "vitest";

import { loadLibrary } from "@/lib/db/library";

vi.mock("server-only", () => ({}));

// A fake PostgREST builder: resolves to `result`, recording the select string used.
function table(results: Record<string, { data?: unknown[]; error?: unknown }>) {
  return (name: string) => {
    let select = "";
    const builder: Record<string, unknown> = {
      select: (s: string) => {
        select = s;
        return builder;
      },
      order: () => builder,
      limit: () =>
        Promise.resolve(
          select.includes("pinned_at") ? results[`${name}:pins`] : results[`${name}:plain`],
        ),
    };
    return builder;
  };
}

describe("loadLibrary", () => {
  it("reads pins when the column exists and aliases project name to title", async () => {
    const client = {
      from: table({
        "projects:pins": {
          data: [{ id: "p1", title: "App", updated_at: "2026-11-16", pinned_at: "2026-11-16" }],
        },
        "conversations:pins": {
          data: [{ id: "c1", title: "Chat", updated_at: "2026-11-15", pinned_at: null }],
        },
      }),
    } as never;
    const lib = await loadLibrary(client);
    expect(lib.pinsEnabled).toBe(true);
    expect(lib.projects).toEqual([
      { id: "p1", title: "App", updatedAt: "2026-11-16", pinned: true },
    ]);
    expect(lib.chats).toEqual([
      { id: "c1", title: "Chat", updatedAt: "2026-11-15", pinned: false },
    ]);
  });

  it("falls back without pins when the column is missing, and never breaks", async () => {
    const client = {
      from: table({
        "projects:pins": { error: { code: "42703" } },
        "projects:plain": { data: [{ id: "p1", title: "App", updated_at: "2026-11-16" }] },
        "conversations:pins": { error: { code: "42703" } },
        "conversations:plain": { data: [{ id: "c1", title: "Chat", updated_at: "2026-11-15" }] },
      }),
    } as never;
    const lib = await loadLibrary(client);
    expect(lib.pinsEnabled).toBe(false);
    expect(lib.projects[0]).toEqual({
      id: "p1",
      title: "App",
      updatedAt: "2026-11-16",
      pinned: false,
    });
    expect(lib.chats[0]?.pinned).toBe(false);
  });
});
