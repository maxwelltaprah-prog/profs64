import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const shimOnly = process.env["TEST_DATABASE_SHIM"] === "1";

const sqlFiles = (dir: string, suffix: string) =>
  readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => readFileSync(path.join(root, dir, f), "utf8"));

const adminUrl = process.env["TEST_DATABASE_URL"] ?? "";
const admin = new Pool({ connectionString: adminUrl, max: 1 });
afterAll(async () => {
  await admin.query("drop database if exists migration_roundtrip with (force)");
  await admin.end();
});

// Runs only against the shim (it needs to create a scratch database). CI's real Supabase
// applies migrations through the CLI, which has no down step.
describe.skipIf(!shimOnly)("migrations are reversible", () => {
  it("up, down and up again leaves a working schema", async () => {
    await admin.query("drop database if exists migration_roundtrip with (force)");
    await admin.query("create database migration_roundtrip");
    const url = new URL(adminUrl);
    url.pathname = "/migration_roundtrip";
    const db = new Pool({ connectionString: url.toString(), max: 1 });
    try {
      await db.query(
        readFileSync(path.join(root, "tests/integration/shim/supabase-shim.sql"), "utf8"),
      );
      for (const sql of sqlFiles("supabase/migrations", ".sql")) await db.query(sql);

      const tables = async () =>
        (await db.query("select count(*)::int as n from pg_tables where schemaname = 'public'"))
          .rows[0]?.n;
      const functions = async () =>
        (
          await db.query(
            "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'",
          )
        ).rows[0]?.n;
      expect(await tables()).toBe(6);

      for (const sql of sqlFiles("supabase/down", ".down.sql").reverse()) await db.query(sql);
      expect(await tables()).toBe(0);
      expect(await functions()).toBe(0);
      const trigger = await db.query(
        "select 1 from pg_trigger where tgname = 'on_auth_user_created'",
      );
      expect(trigger.rowCount).toBe(0);

      for (const sql of sqlFiles("supabase/migrations", ".sql")) await db.query(sql);
      expect(await tables()).toBe(6);
      await db.query(
        "insert into auth.users (id, email) values (gen_random_uuid(), 'x@example.test')",
      );
      const grant = await db.query("select credit_balance from profiles");
      expect(grant.rows[0]?.credit_balance).toBe("20.00");
    } finally {
      await db.end();
    }
  });
});
