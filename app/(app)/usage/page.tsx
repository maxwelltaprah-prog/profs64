import Link from "next/link";
import { redirect } from "next/navigation";

import { UsageChart } from "@/components/usage/usage-chart";
import { formatCredits } from "@/lib/credits/math";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";
import { loadUsage } from "@/lib/db/usage";
import { reasonLabel } from "@/lib/workspace/usage";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Usage" };

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-hairline bg-surface rounded-2xl border p-5">
      <p className="page-in text-muted text-[13px]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-subtle mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export default async function UsagePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/usage");

  const [shell, usage] = await Promise.all([loadShell(user.id), loadUsage()]);
  const projectName = new Map(shell.projects.map((p) => [p.id, p.name]));

  return (
    <>
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-4xl">
          <p className="text-muted text-[13px]">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Usage and activity</h1>
          <p className="text-muted mt-2 text-sm">
            How your credits have been spent. Figures are in UTC.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Available now" value={formatCredits(shell.balance)} />
            <Stat label="Spent (30 days)" value={formatCredits(usage.spentLast30)} />
            <Stat
              label="Spent all time"
              value={formatCredits(usage.totalSpent)}
              hint={`${formatCredits(usage.granted)} granted in total`}
            />
          </div>

          <section
            aria-labelledby="chart-title"
            className="border-hairline bg-surface mt-6 rounded-2xl border p-5"
          >
            <h2 id="chart-title" className="text-sm font-semibold">
              Credits used per day
            </h2>
            <p className="text-muted mt-0.5 text-xs">Last 30 days</p>
            <div className="mt-4">
              <UsageChart data={usage.byDay} />
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="by-project">
              <h2 id="by-project" className="text-sm font-semibold">
                By project
              </h2>
              {usage.byProject.length === 0 ? (
                <p className="text-muted mt-3 text-[13px]">No usage yet.</p>
              ) : (
                <ul className="divide-hairline border-hairline bg-surface mt-3 divide-y rounded-xl border">
                  {usage.byProject.slice(0, 8).map((entry) => (
                    <li
                      key={entry.projectId ?? "none"}
                      className="flex items-center justify-between gap-4 px-4 py-2.5"
                    >
                      <span className="truncate text-[13px]">
                        {entry.projectId
                          ? (projectName.get(entry.projectId) ?? "A project")
                          : "Chat and other"}
                      </span>
                      <span className="text-muted shrink-0 text-[13px] tabular-nums">
                        {formatCredits(entry.credits)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="recent-activity">
              <h2 id="recent-activity" className="text-sm font-semibold">
                Recent activity
              </h2>
              {usage.recent.length === 0 ? (
                <p className="text-muted mt-3 text-[13px]">Nothing yet.</p>
              ) : (
                <ul className="divide-hairline border-hairline bg-surface mt-3 divide-y rounded-xl border">
                  {usage.recent.map((row, index) => (
                    <li key={index} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-[13px]">{reasonLabel(row.reason)}</span>
                        <span
                          className="text-subtle block text-xs"
                          title={timeFormat.format(new Date(row.createdAt))}
                        >
                          {dateFormat.format(new Date(row.createdAt))}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-[13px] tabular-nums ${row.delta >= 0 ? "text-success" : "text-muted"}`}
                      >
                        {row.delta >= 0 ? "+" : ""}
                        {formatCredits(row.delta)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="mt-8">
            <Link href="/upgrade" className="text-accent text-[13px] underline underline-offset-4">
              Need more credits?
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
