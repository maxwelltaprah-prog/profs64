import { describe, expect, it } from "vitest";

import { reasonLabel, summariseUsage, type LedgerRow } from "@/lib/workspace/usage";

const now = new Date("2026-11-16T12:00:00Z");
const row = (over: Partial<LedgerRow>): LedgerRow => ({
  delta: -1,
  reason: "chat_usage",
  projectId: null,
  model: "z-ai/glm-5.2",
  createdAt: "2026-11-16T10:00:00Z",
  ...over,
});

describe("summariseUsage", () => {
  it("totals only spend, keeps grants separate, and rounds to cents", () => {
    const s = summariseUsage(
      [
        row({ delta: -0.42 }),
        row({ delta: -1.21, createdAt: "2026-11-15T10:00:00Z" }),
        row({ delta: 20, reason: "signup_grant" }),
        row({ delta: 5, reason: "refund" }),
      ],
      now,
    );
    expect(s.totalSpent).toBe(1.63);
    expect(s.granted).toBe(25);
  });

  it("builds a continuous 30-day series ending today, filling gaps with zero", () => {
    const s = summariseUsage([row({ delta: -2, createdAt: "2026-11-16T09:00:00Z" })], now);
    expect(s.byDay).toHaveLength(30);
    expect(s.byDay.at(-1)).toEqual({ date: "2026-11-16", credits: 2 });
    expect(s.byDay.at(0)?.date).toBe("2026-10-18");
    expect(s.byDay.filter((d) => d.credits === 0)).toHaveLength(29);
    expect(s.spentLast30).toBe(2);
  });

  it("excludes spend older than the window from spentLast30 but keeps it in totalSpent", () => {
    const s = summariseUsage(
      [row({ delta: -3, createdAt: "2026-09-01T10:00:00Z" }), row({ delta: -1 })],
      now,
    );
    expect(s.totalSpent).toBe(4);
    expect(s.spentLast30).toBe(1);
  });

  it("groups spend by project, busiest first, dropping empty and non-spend", () => {
    const s = summariseUsage(
      [
        row({ delta: -1, projectId: "a" }),
        row({ delta: -3, projectId: "b" }),
        row({ delta: -0.5, projectId: "a" }),
        row({ delta: 20, reason: "signup_grant", projectId: null }),
      ],
      now,
    );
    expect(s.byProject).toEqual([
      { projectId: "b", credits: 3 },
      { projectId: "a", credits: 1.5 },
    ]);
  });

  it("returns the most recent rows first, capped at 12", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({ delta: -1, createdAt: `2026-11-${String(i + 1).padStart(2, "0")}T10:00:00Z` }),
    );
    const s = summariseUsage(rows, now);
    expect(s.recent).toHaveLength(12);
    expect(s.recent[0]?.createdAt).toBe("2026-11-20T10:00:00Z");
  });

  it("is safe on empty input and bad dates", () => {
    const s = summariseUsage([row({ createdAt: "not a date" })], now);
    expect(s.byDay).toHaveLength(30);
    expect(summariseUsage([]).totalSpent).toBe(0);
  });

  it("labels reasons for people", () => {
    expect(reasonLabel("chat_usage")).toBe("Usage");
    expect(reasonLabel("signup_grant")).toBe("Signup credits");
    expect(reasonLabel("weird")).toBe("weird");
  });
});
