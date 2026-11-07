import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  asService,
  asUser,
  CHECK_VIOLATION,
  createProject,
  createUser,
  pool,
  prepareDatabase,
  seedProjectData,
  sqlState,
  UNIQUE_VIOLATION,
} from "./helpers";

beforeAll(prepareDatabase);
afterAll(async () => {
  await pool.end();
});

const APPEND_ONLY = "42501";

describe("credit_ledger and audit_log are append-only", () => {
  it.each([
    ["credit_ledger", "update credit_ledger set delta = 99"],
    ["credit_ledger", "delete from credit_ledger"],
    ["credit_ledger", "truncate credit_ledger"],
    ["audit_log", "update audit_log set event = 'x'"],
    ["audit_log", "delete from audit_log"],
    ["audit_log", "truncate audit_log"],
  ])("%s refuses: %s (even for the table owner)", async (_table, sql) => {
    await createUser("append");
    expect(await sqlState(pool.query(sql))).toBe(APPEND_ONLY);
  });

  it("service_role cannot rewrite history either", async () => {
    const user = await createUser("svc");
    expect(
      await sqlState(
        asService((c) => c.query("update credit_ledger set delta = 99 where user_id = $1", [user])),
      ),
    ).toBe(APPEND_ONLY);
    expect(
      await sqlState(
        asService((c) => c.query("delete from credit_ledger where user_id = $1", [user])),
      ),
    ).toBe(APPEND_ONLY);
  });

  it("an anonymizing update cannot smuggle in another change", async () => {
    const user = await createUser("smuggle");
    expect(
      await sqlState(
        pool.query("update credit_ledger set user_id = null, delta = 500 where user_id = $1", [
          user,
        ]),
      ),
    ).toBe(APPEND_ONLY);
    expect(
      await sqlState(
        pool.query("update credit_ledger set user_id = $2 where user_id = $1", [
          user,
          await createUser("other"),
        ]),
      ),
    ).toBe(APPEND_ONLY);
  });
});

describe("account and project deletion", () => {
  it("deleting a user removes their data but keeps anonymized financial records", async () => {
    const user = await createUser("gone");
    const project = await seedProjectData(user);
    await asService(
      (c) =>
        c.query("select * from public.deduct_credits($1, 2, $2, 'm', 1, 1, 0.01)", [user, project]),
      {
        commit: true,
      },
    );

    await pool.query("delete from auth.users where id = $1", [user]);

    for (const table of ["profiles", "projects"]) {
      const { rowCount } = await pool.query(
        `select 1 from ${table} where ${table === "profiles" ? "id" : "owner_id"} = $1`,
        [user],
      );
      expect(rowCount, table).toBe(0);
    }
    expect(
      (await pool.query("select 1 from project_files where project_id = $1", [project])).rowCount,
    ).toBe(0);
    expect(
      (await pool.query("select 1 from messages where project_id = $1", [project])).rowCount,
    ).toBe(0);

    const ledger = await pool.query(
      "select user_id, project_id, delta from credit_ledger where user_id is null and delta = -2.00 and model = 'm' order by id desc limit 1",
    );
    expect(ledger.rows[0]).toMatchObject({ user_id: null, project_id: null, delta: "-2.00" });
  });

  it("deleting a project anonymizes its ledger rows instead of failing", async () => {
    const user = await createUser("proj");
    const project = await createProject(user);
    await asService(
      (c) =>
        c.query("select * from public.deduct_credits($1, 1, $2, 'm', 1, 1, 0.01)", [user, project]),
      {
        commit: true,
      },
    );
    await asUser(user, (c) => c.query("delete from projects where id = $1", [project]), {
      commit: true,
    });
    const { rows } = await pool.query(
      "select project_id from credit_ledger where user_id = $1 and reason = 'chat_usage'",
      [user],
    );
    expect(rows).toEqual([{ project_id: null }]);
  });

  it("records an audit event when a project is deleted, and not when an account is", async () => {
    const user = await createUser("audit-del");
    const project = await createProject(user);
    await asUser(user, (c) => c.query("delete from projects where id = $1", [project]), {
      commit: true,
    });
    const events = await pool.query(
      "select event, metadata from audit_log where user_id = $1 and event = 'project_deleted'",
      [user],
    );
    expect(events.rows).toEqual([{ event: "project_deleted", metadata: { project_id: project } }]);

    const leaver = await createUser("audit-leave");
    const leaverProject = await createProject(leaver);
    await pool.query("delete from auth.users where id = $1", [leaver]);
    const after = await pool.query(
      "select 1 from audit_log where event = 'project_deleted' and metadata->>'project_id' = $1",
      [leaverProject],
    );
    expect(after.rowCount).toBe(0);
  });

  it("export_user_data returns the owner's data only", async () => {
    const owner = await createUser("export");
    const other = await createUser("export-other");
    const project = await seedProjectData(owner);
    await seedProjectData(other);
    const { rows } = await asService((c) =>
      c.query("select public.export_user_data($1) as data", [owner]),
    );
    const data = rows[0]?.data;
    expect(data.profile.id).toBe(owner);
    expect(data.projects.map((p: { id: string }) => p.id)).toEqual([project]);
    expect(data.files).toHaveLength(1);
    expect(data.messages).toHaveLength(1);
    expect(data.credit_ledger.every((r: { user_id: string }) => r.user_id === owner)).toBe(true);
  });
});

describe("project_files constraints", () => {
  const insertFile = (user: string, project: string, filePath: string, content = "") =>
    asUser(user, (c) =>
      c.query("insert into project_files (project_id, path, content) values ($1, $2, $3)", [
        project,
        filePath,
        content,
      ]),
    );

  it.each([
    "/etc/passwd.txt",
    "../secret.ts",
    "src/../../secret.ts",
    "src\\evil.ts",
    "%2e%2e/secret.ts",
    "src/%2e%2e/x.ts",
    "src/App.exe",
    "Makefile",
    "",
  ])("rejects unsafe or disallowed path %j", async (filePath) => {
    const user = await createUser("path");
    const project = await createProject(user);
    expect(await sqlState(insertFile(user, project, filePath))).toBe(CHECK_VIOLATION);
  });

  it.each([
    "src/App.tsx",
    "index.html",
    "src/styles/main.css",
    "README.md",
    "public/logo.svg",
    "notes.txt",
  ])("accepts %s", async (filePath) => {
    const user = await createUser("okpath");
    const project = await createProject(user);
    expect(await sqlState(insertFile(user, project, filePath))).toBe("ok");
  });

  it("caps file size at 200KB", async () => {
    const user = await createUser("size");
    const project = await createProject(user);
    expect(await sqlState(insertFile(user, project, "a.txt", "x".repeat(204_800)))).toBe("ok");
    expect(await sqlState(insertFile(user, project, "b.txt", "x".repeat(204_801)))).toBe(
      CHECK_VIOLATION,
    );
  });

  it("enforces unique paths per project", async () => {
    const user = await createUser("uniq");
    const project = await createProject(user);
    await asUser(
      user,
      (c) => c.query("insert into project_files (project_id, path) values ($1, 'a.ts')", [project]),
      { commit: true },
    );
    expect(await sqlState(insertFile(user, project, "a.ts"))).toBe(UNIQUE_VIOLATION);
  });

  it("caps a project at 100 files even under concurrent inserts", async () => {
    const user = await createUser("cap");
    const project = await createProject(user);
    const attempts = await Promise.all(
      Array.from({ length: 120 }, (_, i) =>
        sqlState(
          asUser(
            user,
            (c) =>
              c.query("insert into project_files (project_id, path) values ($1, $2)", [
                project,
                `f${i}.ts`,
              ]),
            {
              commit: true,
            },
          ),
        ),
      ),
    );
    expect(attempts.filter((s) => s === "ok")).toHaveLength(100);
    const { rows } = await pool.query(
      "select count(*)::int as n from project_files where project_id = $1",
      [project],
    );
    expect(rows[0]?.n).toBe(100);
  });
});

describe("row caps", () => {
  it("caps a user at 50 projects even under concurrent inserts", async () => {
    const user = await createUser("project-cap");
    const attempts = await Promise.all(
      Array.from({ length: 60 }, (_, i) =>
        sqlState(
          asUser(
            user,
            (c) =>
              c.query("insert into projects (owner_id, name) values ($1, $2)", [user, `p${i}`]),
            {
              commit: true,
            },
          ),
        ),
      ),
    );
    expect(attempts.filter((s) => s === "ok")).toHaveLength(50);
    expect(attempts.filter((s) => s !== "ok").every((s) => s === CHECK_VIOLATION)).toBe(true);
  });

  it("caps a conversation at 2000 messages", async () => {
    const user = await createUser("message-cap");
    const project = await createProject(user);
    await pool.query(
      "insert into messages (project_id, role, parts) select $1, 'user', '[]'::jsonb from generate_series(1, 2000)",
      [project],
    );
    expect(
      await sqlState(
        asUser(user, (c) =>
          c.query("insert into messages (project_id, role, parts) values ($1, 'user', '[]')", [
            project,
          ]),
        ),
      ),
    ).toBe(CHECK_VIOLATION);
  });

  it("rejects oversized message parts and non-array parts", async () => {
    const user = await createUser("message-shape");
    const project = await createProject(user);
    const insert = (parts: string) =>
      asUser(user, (c) =>
        c.query("insert into messages (project_id, role, parts) values ($1, 'user', $2::jsonb)", [
          project,
          parts,
        ]),
      );
    expect(await sqlState(insert('{"not":"an array"}'))).toBe(CHECK_VIOLATION);
    expect(
      await sqlState(insert(JSON.stringify([{ type: "text", text: "x".repeat(1_048_577) }]))),
    ).toBe(CHECK_VIOLATION);
    expect(await sqlState(insert('[{"type":"text","text":"ok"}]'))).toBe("ok");
  });
});
