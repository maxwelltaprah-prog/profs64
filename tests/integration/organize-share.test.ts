import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asService,
  asUser,
  createProject,
  createUser,
  pool,
  prepareDatabase,
} from "./helpers";

let alice: string;
let bob: string;
let shared: string;
let privateProject: string;

beforeAll(async () => {
  await prepareDatabase();
  alice = await createUser("alice-share");
  bob = await createUser("bob-share");
  shared = await createProject(alice, "Shared app");
  privateProject = await createProject(alice, "Private app");
  await asService(
    async (db) => {
      await db.query(
        "insert into project_files (project_id, path, content) values ($1, 'src/App.tsx', 'export default () => null'), ($1, 'index.html', '<div id=root></div>')",
        [shared],
      );
      await db.query("update projects set share_slug = 'abc123xyz' where id = $1", [shared]);
      await db.query(
        "insert into project_files (project_id, path, content) values ($1, 'secret.ts', 'TOP SECRET')",
        [privateProject],
      );
    },
    { commit: true },
  );
});

afterAll(async () => {
  await pool.end();
});

describe("public share reader", () => {
  it("returns a shared project's name and files to an anonymous visitor", async () => {
    const rows = await asAnon(
      async (db) => (await db.query("select * from get_shared_project('abc123xyz')")).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Shared app");
    const files = rows[0].files as Array<{ path: string; content: string }>;
    expect(files.map((f) => f.path).sort()).toEqual(["index.html", "src/App.tsx"]);
  });

  it("returns nothing for an unknown slug or an unshared project", async () => {
    const miss = await asAnon(
      async (db) => (await db.query("select * from get_shared_project('nope')")).rows,
    );
    expect(miss).toHaveLength(0);
    // The private project's slug is null; no slug value can reach it.
    const nullSlug = await asAnon(
      async (db) => (await db.query("select * from get_shared_project(null)")).rows,
    );
    expect(nullSlug).toHaveLength(0);
  });

  it("never exposes a private project's files, even by guessing", async () => {
    const leaked = await asAnon(
      async (db) =>
        (
          await db.query(
            "select * from get_shared_project('') union all select * from get_shared_project('secret')",
          )
        ).rows,
    );
    expect(leaked).toHaveLength(0);
    // anon still cannot read project_files directly.
    const direct = await asAnon((db) =>
      db.query("select content from project_files").catch((e) => e),
    );
    expect(String(direct)).toMatch(/permission denied|denied/i);
  });
});

describe("pins", () => {
  it("lets an owner pin their own project and conversation, but not someone else's", async () => {
    const pinned = await asUser(alice, (db) =>
      db.query("update projects set pinned_at = now() where id = $1", [shared]),
    );
    expect(pinned.rowCount).toBe(1);

    const chat = await asService(
      async (db) =>
        (
          await db.query(
            "insert into conversations (owner_id, title) values ($1, 'c') returning id",
            [alice],
          )
        ).rows[0].id as string,
      { commit: true },
    );
    const pinChat = await asUser(alice, (db) =>
      db.query("update conversations set pinned_at = now() where id = $1", [chat]),
    );
    expect(pinChat.rowCount).toBe(1);

    const notMine = await asUser(bob, (db) =>
      db.query("update projects set pinned_at = now() where id = $1", [shared]),
    );
    expect(notMine.rowCount).toBe(0);
  });
});
