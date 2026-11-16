import { randomUUID } from "node:crypto";

import { type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createUser, pool, prepareDatabase, withRole } from "./helpers";

beforeAll(prepareDatabase);
afterAll(() => pool.end());

// Runs fn in a transaction with the gate switched on, then rolls everything back.
async function withGate<T>(entries: string[], fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("update public.app_settings set value = 'on' where key = 'beta_gate'");
    for (const entry of entries)
      await client.query("insert into public.beta_allowlist (entry) values ($1)", [entry]);
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

const signUp = async (client: PoolClient, email: string | null) => {
  await client.query("savepoint s");
  try {
    await client.query("insert into auth.users (id, email) values ($1, $2)", [randomUUID(), email]);
    return "created";
  } catch (error) {
    await client.query("rollback to savepoint s");
    return (error as Error).message;
  }
};

describe("closed beta gate", () => {
  it("rejects an address that is not listed, for any way an account is created", async () => {
    await withGate(["friend@example.test"], async (client) => {
      expect(await signUp(client, "stranger@example.test")).toBe("beta_invite_only");
      expect(await signUp(client, null)).toBe("beta_invite_only");
    });
  });

  it("allows a listed address, ignoring case, and a listed domain", async () => {
    await withGate(["friend@example.test", "@team.example.test"], async (client) => {
      expect(await signUp(client, "Friend@Example.Test")).toBe("created");
      expect(await signUp(client, "anyone@team.example.test")).toBe("created");
      // A look-alike domain or a sub-domain is not the listed domain.
      expect(await signUp(client, "anyone@evilteam.example.test")).toBe("beta_invite_only");
      expect(await signUp(client, "anyone@sub.team.example.test")).toBe("beta_invite_only");
    });
  });

  it("lets everyone in once the gate is switched off", async () => {
    await withGate([], async (client) => {
      await client.query("update public.app_settings set value = 'off' where key = 'beta_gate'");
      expect(await signUp(client, "stranger@example.test")).toBe("created");
    });
  });

  it("fails closed when the setting row is missing", async () => {
    await withGate([], async (client) => {
      await client.query("delete from public.app_settings where key = 'beta_gate'");
      expect(await signUp(client, "stranger@example.test")).toBe("beta_invite_only");
    });
  });

  it("rejects malformed allowlist entries", async () => {
    await withGate([], async (client) => {
      for (const bad of [
        "Upper@Case.test",
        "no-at-sign",
        "two@@signs.test",
        "has space@x.test",
        "@",
      ]) {
        await client.query("savepoint e");
        await expect(
          client.query("insert into public.beta_allowlist (entry) values ($1)", [bad]),
        ).rejects.toThrow();
        await client.query("rollback to savepoint e");
      }
    });
  });

  it("is not callable or readable by people or the browser roles", async () => {
    const user = await createUser("gate");
    await withRole({ role: "authenticated", userId: user }, async (client) => {
      await client.query("savepoint a");
      await expect(client.query("select public.is_email_invited('a@b.test')")).rejects.toThrow(
        /permission denied/,
      );
      await client.query("rollback to savepoint a");
      await client.query("savepoint b");
      await expect(client.query("select * from public.beta_allowlist")).rejects.toThrow(
        /permission denied/,
      );
      await client.query("rollback to savepoint b");
    });
    await withRole({ role: "service_role" }, async (client) => {
      const { rows } = await client.query("select public.is_email_invited('a@b.test') as ok");
      expect(typeof rows[0]?.ok).toBe("boolean");
    });
  });
});

describe("feedback", () => {
  it("lets a person add and read their own feedback and nobody else's", async () => {
    const [alice, bob] = [await createUser("fa"), await createUser("fb")];
    await withRole(
      { role: "authenticated", userId: alice },
      async (client) => {
        await client.query("insert into public.feedback (user_id, message) values ($1, 'works')", [
          alice,
        ]);
      },
      { commit: true },
    );
    await withRole({ role: "authenticated", userId: bob }, async (client) => {
      expect((await client.query("select * from public.feedback")).rows).toHaveLength(0);
      await client.query("savepoint f");
      await expect(
        client.query("insert into public.feedback (user_id, message) values ($1, 'forged')", [
          alice,
        ]),
      ).rejects.toThrow(/row-level security/);
      await client.query("rollback to savepoint f");
      await client.query("savepoint g");
      await expect(
        client.query("insert into public.feedback (user_id, message) values ($1, '')", [bob]),
      ).rejects.toThrow();
      await client.query("rollback to savepoint g");
    });
    await withRole({ role: "authenticated", userId: alice }, async (client) => {
      expect((await client.query("select message from public.feedback")).rows).toEqual([
        { message: "works" },
      ]);
    });
  });
});
