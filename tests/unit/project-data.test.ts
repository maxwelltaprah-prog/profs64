// @vitest-environment jsdom
import { transform } from "sucrase";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_HELPER_SOURCE } from "@/lib/templates/db-helper";
import { parseDataRequest, runDataRequest } from "@/lib/workspace/data-bridge";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const REC = "22222222-2222-4222-8222-222222222222";

describe("parseDataRequest", () => {
  const ok = { type: "buildr-data", id: "q1", op: "list", collection: "todos" };
  it("accepts well-formed requests", () => {
    expect(parseDataRequest(ok)).toEqual({ id: "q1", op: "list", collection: "todos" });
    expect(parseDataRequest({ ...ok, op: "create", data: { a: 1 } })?.data).toEqual({ a: 1 });
    expect(parseDataRequest({ ...ok, op: "remove", recordId: REC })?.recordId).toBe(REC);
  });
  it("rejects anything outside the whitelist", () => {
    const bad: unknown[] = [
      null,
      "x",
      [],
      { ...ok, type: "other" },
      { ...ok, op: "drop" },
      { ...ok, collection: "../other" },
      { ...ok, collection: "A" },
      { ...ok, collection: "a".repeat(41) },
      { ...ok, id: "x".repeat(40) },
      { ...ok, op: "create" },
      { ...ok, op: "create", data: [1] },
      { ...ok, op: "create", data: { big: "x".repeat(17000) } },
      { ...ok, op: "update", data: {}, recordId: "../x" },
      { ...ok, op: "remove" },
    ];
    for (const message of bad) expect(parseDataRequest(message)).toBeNull();
  });
});

describe("runDataRequest", () => {
  const request = { id: "q1", op: "create" as const, collection: "todos", data: { t: 1 } };
  it("calls only this project's API, with the page's project id", async () => {
    const fetcher = vi.fn(async () => Response.json({ record: { id: REC } }, { status: 201 }));
    const reply = await runDataRequest(PROJECT, request, fetcher as never);
    expect(reply).toMatchObject({ ok: true, id: "q1", result: { id: REC } });
    expect(fetcher).toHaveBeenCalledWith(
      `/api/projects/${PROJECT}/data/todos`,
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("has no store in a shared preview, so the helper falls back", async () => {
    const fetcher = vi.fn();
    expect(await runDataRequest(null, request, fetcher as never)).toMatchObject({
      ok: false,
      code: "unavailable",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("treats an un-migrated database and network failure as unavailable, and passes real errors on", async () => {
    const make = (status: number, code: string, message = "m") =>
      vi.fn(async () => Response.json({ error: { code, message } }, { status }));
    expect(
      await runDataRequest(PROJECT, request, make(503, "database_update_needed") as never),
    ).toMatchObject({ code: "unavailable" });
    expect(
      await runDataRequest(PROJECT, request, make(409, "record_limit", "Full") as never),
    ).toMatchObject({ ok: false, code: "record_limit", message: "Full" });
    const boom = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await runDataRequest(PROJECT, request, boom as never)).toMatchObject({
      code: "unavailable",
    });
  });
});

describe("db helper source (browser fallback, outside Buildr)", () => {
  beforeEach(() => window.localStorage.clear());
  const load = () => {
    const js = transform(DB_HELPER_SOURCE, { transforms: ["typescript"] }).code;
    const exports: Record<string, unknown> = {};
    // The helper is project code that runs in a browser; running it here is the point of the test.
    // eslint-disable-next-line no-new-func
    new Function("exports", js.replace(/export const db/, "exports.db")).call(undefined, exports);
    return exports["db"] as {
      list: (c: string) => Promise<{ id: string; t?: number }[]>;
      create: (c: string, d: object) => Promise<{ id: string }>;
      update: (c: string, id: string, d: object) => Promise<{ t: number }>;
      remove: (c: string, id: string) => Promise<void>;
    };
  };
  it("creates, lists, updates and removes records locally", async () => {
    const db = load();
    const a = await db.create("todos", { t: 1 });
    await db.create("todos", { t: 2 });
    expect((await db.list("todos")).length).toBe(2);
    expect((await db.update("todos", a.id, { t: 9 })).t).toBe(9);
    await db.remove("todos", a.id);
    expect((await db.list("todos")).map((r) => r.t)).toEqual([2]);
  });
});
