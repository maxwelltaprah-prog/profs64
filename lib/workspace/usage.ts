// Pure aggregation for the usage dashboard. Given a person's credit-ledger rows, it produces the
// numbers the page shows: total spent, a daily series for the chart, a per-project breakdown, and
// the most recent entries. No database or React here, so it is unit-tested directly.

export interface LedgerRow {
  delta: number;
  reason: string;
  projectId: string | null;
  model: string | null;
  createdAt: string;
}

export interface DayPoint {
  date: string; // YYYY-MM-DD (UTC)
  credits: number; // credits spent that day
}

export interface ProjectSpend {
  projectId: string | null;
  credits: number;
}

export interface UsageSummary {
  totalSpent: number;
  granted: number;
  spentLast30: number;
  byDay: DayPoint[];
  byProject: ProjectSpend[];
  recent: LedgerRow[];
}

const utcDay = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Spending is a negative delta with reason "chat_usage"; grants and refunds are positive.
export function summariseUsage(
  rows: readonly LedgerRow[],
  now = new Date(),
  days = 30,
): UsageSummary {
  const spend = rows.filter((row) => row.reason === "chat_usage");
  const totalSpent = round2(spend.reduce((sum, row) => sum + Math.max(0, -row.delta), 0));
  const granted = round2(
    rows.filter((row) => row.delta > 0).reduce((sum, row) => sum + row.delta, 0),
  );

  // A continuous day series ending today, so the chart has no gaps.
  const perDay = new Map<string, number>();
  for (const row of spend) {
    const day = utcDay(row.createdAt);
    if (day) perDay.set(day, (perDay.get(day) ?? 0) + Math.max(0, -row.delta));
  }
  const byDay: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.push({ date, credits: round2(perDay.get(date) ?? 0) });
  }
  const spentLast30 = round2(byDay.reduce((sum, point) => sum + point.credits, 0));

  const perProject = new Map<string | null, number>();
  for (const row of spend) {
    const key = row.projectId;
    perProject.set(key, (perProject.get(key) ?? 0) + Math.max(0, -row.delta));
  }
  const byProject: ProjectSpend[] = [...perProject.entries()]
    .map(([projectId, credits]) => ({ projectId, credits: round2(credits) }))
    .filter((entry) => entry.credits > 0)
    .sort((a, b) => b.credits - a.credits);

  const recent = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 12);

  return { totalSpent, granted, spentLast30, byDay, byProject, recent };
}

export function reasonLabel(reason: string): string {
  switch (reason) {
    case "chat_usage":
      return "Usage";
    case "signup_grant":
      return "Signup credits";
    case "refund":
      return "Refund";
    case "admin_adjustment":
      return "Adjustment";
    default:
      return reason;
  }
}
