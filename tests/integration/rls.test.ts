import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asService,
  asUser,
  createUser,
  PERMISSION_DENIED,
  pool,
  prepareDatabase,
  seedProjectData,
  sqlState,
} from "./helpers";

const TABLES = ["profiles", "projects", "project_files", "messages", "credit_ledger", "audit_log"];

let alice: string;
let bob: string;
let aliceProject: string;

beforeAll(async () => {
  await prepareDatabase();
  alice = await createUser("alice");
  bob = await createUser("bob");
  aliceProject = await seedProjectData(alice);
  await seedProjectData(bob);
});

afterAll(async () => {
  await pool.end();
});

describe("RLS is on and default deny everywhere", () => {
  it("every public table has RLS enabled and forced", async () => {
    const { rows } = await pool.query(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} RLS`).toBe(true);
      expect(row.relforcerowsecurity, `${row.relname} forced RLS`).toBe(true);
    }
  });

  it("no public function is executable by anon or authenticated", async () => {
    const { rows } = await pool.query(
      `select p.oid::regprocedure::text as signature,
              has_function_privilege('anon', p.oid, 'execute') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.anon_exec, `${row.signature} anon`).toBe(false);
      expect(row.auth_exec, `${row.signature} authenticated`).toBe(false);
    }
  });

  it.each(TABLES)("anon cannot read %s", async (table) => {
    expect(await sqlState(asAnon((c) => c.query(`select * from public.${table}`)))).toBe(
      PERMISSION_DENIED,
    );
  });
});

describe("user A cannot read user B's data", () => {
  it("sees only their own rows in every table", async () => {
    for (const table of TABLES) {
      const { rows } = await asUser(bob, (c) => c.query(`select * from public.${table}`));
      for (const row of rows) {
        const owner = row.owner_id ?? row.user_id ?? row.id;
        if (table === "project_files" || table === "messages") continue;
        expect(owner, `${table} leaked a foreign row`).not.toBe(alice);
      }
    }
    const files = await asUser(bob, (c) => c.query("select * from project_files"));
    expect(files.rows.every((r) => r.project_id !== aliceProject)).toBe(true);
    const messages = await asUser(bob, (c) => c.query("select * from messages"));
    expect(messages.rows.every((r) => r.project_id !== aliceProject)).toBe(true);
  });

  it("cannot fetch A's rows by direct id", async () => {
    const byId = await asUser(bob, (c) =>
      c.query("select * from projects where id = $1", [aliceProject]),
    );
    expect(byId.rowCount).toBe(0);
    const files = await asUser(bob, (c) =>
      c.query("select * from project_files where project_id = $1", [aliceProject]),
    );
    expect(files.rowCount).toBe(0);
    const profile = await asUser(bob, (c) =>
      c.query("select * from profiles where id = $1", [alice]),
    );
    expect(profile.rowCount).toBe(0);
    const ledger = await asUser(bob, (c) =>
      c.query("select * from credit_ledger where user_id = $1", [alice]),
    );
    expect(ledger.rowCount).toBe(0);
    const audit = await asUser(bob, (c) =>
      c.query("select * from audit_log where user_id = $1", [alice]),
    );
    expect(audit.rowCount).toBe(0);
  });

  it("cannot reach A's data through joins or subqueries", async () => {
    const joined = await asUser(bob, (c) =>
      c.query(
        `select f.path, m.parts from projects p
         join project_files f on f.project_id = p.id
         left join messages m on m.project_id = p.id
         where p.id = $1`,
        [aliceProject],
      ),
    );
    expect(joined.rowCount).toBe(0);
    const viaIn = await asUser(bob, (c) =>
      c.query("select * from project_files where project_id in (select id from projects)"),
    );
    expect(viaIn.rows.every((r) => r.project_id !== aliceProject)).toBe(true);
  });

  it("A can read their own data", async () => {
    const projects = await asUser(alice, (c) => c.query("select id from projects"));
    expect(projects.rows.map((r) => r.id)).toContain(aliceProject);
    const files = await asUser(alice, (c) =>
      c.query("select path from project_files where project_id = $1", [aliceProject]),
    );
    expect(files.rowCount).toBe(1);
    const ledger = await asUser(alice, (c) => c.query("select delta, reason from credit_ledger"));
    expect(ledger.rows).toEqual([{ delta: "20.00", reason: "signup_grant" }]);
  });
});

describe("user A cannot update or delete user B's data", () => {
  it("updates and deletes match zero rows", async () => {
    const statements: [string, unknown[]][] = [
      ["update projects set name = 'pwned' where id = $1", [aliceProject]],
      ["delete from projects where id = $1", [aliceProject]],
      ["update project_files set content = 'pwned' where project_id = $1", [aliceProject]],
      ["delete from project_files where project_id = $1", [aliceProject]],
    ];
    for (const [sql, params] of statements) {
      const result = await asUser(bob, (c) => c.query(sql, params));
      expect(result.rowCount, sql).toBe(0);
    }
    const intact = await pool.query("select name from projects where id = $1", [aliceProject]);
    expect(intact.rows[0]?.name).toBe("Seeded");
  });

  it("cannot move a project to another owner or into another tenant", async () => {
    const own = await createOwnedProject(bob);
    expect(
      await sqlState(
        asUser(bob, (c) =>
          c.query("update projects set owner_id = $1 where id = $2", [alice, own]),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
  });

  it("cannot insert rows into A's project or as A", async () => {
    expect(
      await sqlState(
        asUser(bob, (c) =>
          c.query("insert into projects (owner_id, name) values ($1, 'x')", [alice]),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
    expect(
      await sqlState(
        asUser(bob, (c) =>
          c.query("insert into project_files (project_id, path, content) values ($1, 'a.ts', '')", [
            aliceProject,
          ]),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
    expect(
      await sqlState(
        asUser(bob, (c) =>
          c.query("insert into messages (project_id, role, parts) values ($1, 'user', '[]')", [
            aliceProject,
          ]),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
  });

  it("cannot move a file into A's project", async () => {
    const own = await createOwnedProject(bob);
    await asUser(
      bob,
      (c) => c.query("insert into project_files (project_id, path) values ($1, 'a.ts')", [own]),
      { commit: true },
    );
    expect(
      await sqlState(
        asUser(bob, (c) =>
          c.query("update project_files set project_id = $1 where project_id = $2", [
            aliceProject,
            own,
          ]),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
  });
});

describe("credits and audit are server-only", () => {
  it("users cannot change their own balance or profile", async () => {
    for (const sql of [
      "update profiles set credit_balance = 9999 where id = $1",
      "insert into profiles (id, credit_balance) values (gen_random_uuid(), 100)",
      "delete from profiles where id = $1",
    ]) {
      expect(
        await sqlState(asUser(alice, (c) => c.query(sql, sql.includes("$1") ? [alice] : []))),
      ).toBe(PERMISSION_DENIED);
    }
  });

  it("users cannot write the ledger or audit log", async () => {
    for (const sql of [
      "insert into credit_ledger (user_id, delta, reason, balance_after) values ($1, 100, 'refund', 120)",
      "update credit_ledger set delta = 100 where user_id = $1",
      "delete from credit_ledger where user_id = $1",
      "insert into audit_log (user_id, event) values ($1, 'fake')",
      "delete from audit_log where user_id = $1",
    ]) {
      expect(await sqlState(asUser(alice, (c) => c.query(sql, [alice])))).toBe(PERMISSION_DENIED);
    }
  });

  it("users cannot forge assistant messages", async () => {
    const own = await createOwnedProject(alice);
    expect(
      await sqlState(
        asUser(alice, (c) =>
          c.query("insert into messages (project_id, role, parts) values ($1, 'assistant', '[]')", [
            own,
          ]),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
  });
});

describe("RPC functions are not callable by API users", () => {
  const calls: [string, unknown[]][] = [
    ["select * from public.deduct_credits($1, 1, null, 'm', 1, 1, 0.01)", [alice]],
    ["select * from public.record_credit_change($1, 100, 'refund')", [alice]],
    ["select public.credits_spent_today($1)", [alice]],
    ["select public.record_audit_event($1, 'fake')", [alice]],
    ["select public.export_user_data($1)", [alice]],
  ];

  it.each(calls)("authenticated B cannot run %s against A", async (sql, params) => {
    expect(await sqlState(asUser(bob, (c) => c.query(sql, params)))).toBe(PERMISSION_DENIED);
  });

  it.each(calls)("authenticated A cannot run %s on themselves", async (sql, params) => {
    expect(await sqlState(asUser(alice, (c) => c.query(sql, params)))).toBe(PERMISSION_DENIED);
  });

  it.each(calls)("anon cannot run %s", async (sql, params) => {
    expect(await sqlState(asAnon((c) => c.query(sql, params)))).toBe(PERMISSION_DENIED);
  });

  it("service_role can, and a failed attempt by B changed nothing", async () => {
    const balance = await pool.query("select credit_balance from profiles where id = $1", [alice]);
    expect(balance.rows[0]?.credit_balance).toBe("20.00");
    const exported = await asService((c) =>
      c.query("select public.export_user_data($1) as data", [alice]),
    );
    expect(exported.rows[0]?.data.profile.id).toBe(alice);
  });
});

async function createOwnedProject(owner: string): Promise<string> {
  const { rows } = await asUser(
    owner,
    (c) =>
      c.query("insert into projects (owner_id, name) values ($1, 'tmp') returning id", [owner]),
    { commit: true },
  );
  return rows[0].id as string;
}
