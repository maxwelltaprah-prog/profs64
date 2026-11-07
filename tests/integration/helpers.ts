import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Pool, type PoolClient } from "pg";

const root = path.resolve(import.meta.dirname, "../..");

export const pool = new Pool({ connectionString: process.env["TEST_DATABASE_URL"], max: 40 });

const MIGRATION_LOCK = 724_001;

// Applies the shim (plain Postgres only) and every migration, once per database.
export async function prepareDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK]);
    if (process.env["TEST_DATABASE_SHIM"] === "1") {
      const { rows } = await client.query("select to_regnamespace('auth') as auth");
      if (rows[0]?.auth === null) {
        await client.query(
          readFileSync(path.join(root, "tests/integration/shim/supabase-shim.sql"), "utf8"),
        );
      }
    }
    const { rows } = await client.query("select to_regclass('public.profiles') as profiles");
    if (rows[0]?.profiles === null) {
      const dir = path.join(root, "supabase/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        await client.query(readFileSync(path.join(dir, file), "utf8"));
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK]).catch(() => undefined);
    client.release();
  }
}

export async function createUser(label = "user"): Promise<string> {
  const id = randomUUID();
  await pool.query(
    "insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())",
    [id, `${label}-${id}@example.test`],
  );
  return id;
}

type Role = { role: "authenticated"; userId: string } | { role: "anon" } | { role: "service_role" };

// Runs fn in one transaction as the given API role, with Supabase-style JWT claims set.
// Rolled back unless commit is true, so probes leave no residue.
export async function withRole<T>(
  who: Role,
  fn: (client: PoolClient) => Promise<T>,
  options: { commit?: boolean } = {},
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${who.role}`);
    if (who.role === "authenticated") {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [who.userId]);
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: who.userId, role: "authenticated" }),
      ]);
    }
    const result = await fn(client);
    await client.query(options.commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const asUser = <T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
  options?: { commit?: boolean },
) => withRole({ role: "authenticated", userId }, fn, options);

export const asAnon = <T>(fn: (client: PoolClient) => Promise<T>) => withRole({ role: "anon" }, fn);

export const asService = <T>(
  fn: (client: PoolClient) => Promise<T>,
  options?: { commit?: boolean },
) => withRole({ role: "service_role" }, fn, options);

// Postgres error code of a rejected query, or "ok" if it succeeded.
export async function sqlState(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

export const PERMISSION_DENIED = "42501";
export const CHECK_VIOLATION = "23514";
export const UNIQUE_VIOLATION = "23505";

export async function createProject(owner: string, name = "Demo"): Promise<string> {
  const { rows } = await asUser(
    owner,
    (c) =>
      c.query("insert into projects (owner_id, name) values ($1, $2) returning id", [owner, name]),
    { commit: true },
  );
  return rows[0].id as string;
}

export async function seedProjectData(owner: string) {
  const projectId = await createProject(owner, "Seeded");
  await asUser(
    owner,
    async (c) => {
      await c.query(
        "insert into project_files (project_id, path, content) values ($1, 'src/App.tsx', 'x')",
        [projectId],
      );
      await c.query(
        'insert into messages (project_id, role, parts) values ($1, \'user\', \'[{"type":"text","text":"hi"}]\')',
        [projectId],
      );
    },
    { commit: true },
  );
  return projectId;
}
