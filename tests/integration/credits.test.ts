import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asService, createUser, pool, prepareDatabase, sqlState } from "./helpers";

beforeAll(prepareDatabase);
afterAll(async () => {
  await pool.end();
});

const deduct = (user: string, amount: number, extra: { project?: string | null } = {}) =>
  asService(
    (c) =>
      c.query("select * from public.deduct_credits($1, $2, $3, 'test/model', 100, 50, 0.01)", [
        user,
        amount,
        extra.project ?? null,
      ]),
    { commit: true },
  );

const balanceOf = async (user: string) =>
  Number(
    (await pool.query("select credit_balance from profiles where id = $1", [user])).rows[0]
      ?.credit_balance,
  );

const ledgerSum = async (user: string) =>
  Number(
    (
      await pool.query(
        "select coalesce(sum(delta), 0) as s from credit_ledger where user_id = $1",
        [user],
      )
    ).rows[0]?.s,
  );

describe("signup", () => {
  it("creates a profile with a 20-credit grant, a ledger row and an audit event", async () => {
    const user = await createUser("signup");
    const profile = await pool.query("select email, credit_balance from profiles where id = $1", [
      user,
    ]);
    expect(profile.rows[0]?.credit_balance).toBe("20.00");
    const ledger = await pool.query(
      "select delta, reason, balance_after from credit_ledger where user_id = $1",
      [user],
    );
    expect(ledger.rows).toEqual([
      { delta: "20.00", reason: "signup_grant", balance_after: "20.00" },
    ]);
    const audit = await pool.query("select event from audit_log where user_id = $1", [user]);
    expect(audit.rows).toEqual([{ event: "signup" }]);
  });
});

describe("deduct_credits", () => {
  it("deducts, records tokens and cost, and returns the new balance", async () => {
    const user = await createUser("deduct");
    const { rows } = await deduct(user, 1.25);
    expect(rows[0]).toEqual({ charged: "1.25", balance_after: "18.75", shortfall: "0.00" });
    const entry = await pool.query(
      "select delta, reason, model, input_tokens, output_tokens, cost_usd, balance_after from credit_ledger where user_id = $1 and reason = 'chat_usage'",
      [user],
    );
    expect(entry.rows).toEqual([
      {
        delta: "-1.25",
        reason: "chat_usage",
        model: "test/model",
        input_tokens: 100,
        output_tokens: 50,
        cost_usd: "0.010000",
        balance_after: "18.75",
      },
    ]);
  });

  it("clamps a charge larger than the balance instead of going negative", async () => {
    const user = await createUser("clamp");
    const { rows } = await deduct(user, 25);
    expect(rows[0]).toEqual({ charged: "20.00", balance_after: "0.00", shortfall: "5.00" });
    expect(await balanceOf(user)).toBe(0);
  });

  it("writes no ledger row when the balance is already zero", async () => {
    const user = await createUser("empty");
    await deduct(user, 20);
    const before = await pool.query(
      "select count(*)::int as n from credit_ledger where user_id = $1",
      [user],
    );
    const { rows } = await deduct(user, 1);
    expect(rows[0]).toEqual({ charged: "0.00", balance_after: "0.00", shortfall: "1.00" });
    const after = await pool.query(
      "select count(*)::int as n from credit_ledger where user_id = $1",
      [user],
    );
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
  });

  it.each([0, -1])("rejects a non-positive amount (%s)", async (amount) => {
    const user = await createUser("bad");
    expect(await sqlState(deduct(user, amount))).toBe("22023");
    expect(await balanceOf(user)).toBe(20);
  });

  it("rejects an unknown user", async () => {
    expect(await sqlState(deduct("00000000-0000-4000-8000-000000000000", 1))).toBe("P0002");
  });

  it("rounds to two decimals", async () => {
    const user = await createUser("round");
    const { rows } = await deduct(user, 0.126);
    expect(rows[0]?.charged).toBe("0.13");
  });

  it("reports credits spent today", async () => {
    const user = await createUser("today");
    await deduct(user, 2);
    await deduct(user, 0.5);
    const { rows } = await asService((c) =>
      c.query("select public.credits_spent_today($1) as s", [user]),
    );
    expect(Number(rows[0]?.s)).toBe(2.5);
  });
});

describe("concurrency", () => {
  it("parallel requests cannot overspend one user's balance", async () => {
    const user = await createUser("race");
    const results = await Promise.all(Array.from({ length: 40 }, () => deduct(user, 1.5)));
    const charged = results.reduce((sum, r) => sum + Number(r.rows[0]?.charged), 0);
    const shortfall = results.reduce((sum, r) => sum + Number(r.rows[0]?.shortfall), 0);

    expect(charged).toBe(20);
    expect(shortfall).toBeCloseTo(40 * 1.5 - 20, 5);
    expect(await balanceOf(user)).toBe(0);
    // The ledger is the source of truth: grant plus every applied delta equals the balance.
    expect(await ledgerSum(user)).toBe(0);
    const rows = await pool.query(
      "select balance_after from credit_ledger where user_id = $1 order by id",
      [user],
    );
    const balances = rows.rows.map((r) => Number(r.balance_after));
    expect(balances.every((b) => b >= 0)).toBe(true);
    expect(balances).toEqual([...balances].sort((a, b) => b - a));
  });

  it("concurrent users do not interfere with each other", async () => {
    const users = await Promise.all([createUser("a"), createUser("b"), createUser("c")]);
    await Promise.all(users.flatMap((u) => Array.from({ length: 10 }, () => deduct(u, 1))));
    for (const user of users) {
      expect(await balanceOf(user)).toBe(10);
      expect(await ledgerSum(user)).toBe(10);
    }
  });
});

describe("operator refunds and adjustments (documented in docs/RUNBOOK.md)", () => {
  const change = (user: string, delta: number, reason: string) =>
    asService(
      (c) =>
        c.query("select * from public.record_credit_change($1, $2, $3)", [user, delta, reason]),
      { commit: true },
    );

  it("a refund adds credits and writes one ledger row whose balance_after matches", async () => {
    const user = await createUser("refund");
    const before = await balanceOf(user);
    const result = await change(user, 5, "refund");
    expect(Number(result.rows[0]?.balance_after)).toBe(before + 5);
    expect(await balanceOf(user)).toBe(before + 5);
    const rows = await pool.query(
      "select delta, reason, balance_after from credit_ledger where user_id = $1 and reason = 'refund'",
      [user],
    );
    expect(rows.rows).toHaveLength(1);
    expect(Number(rows.rows[0]?.delta)).toBe(5);
    expect(Number(rows.rows[0]?.balance_after)).toBe(before + 5);
  });

  it("rejects an unknown reason and a zero change", async () => {
    const user = await createUser("badreason");
    expect(await sqlState(change(user, 5, "bonus"))).not.toBe("ok");
    expect(await sqlState(change(user, 0, "refund"))).not.toBe("ok");
  });
});
