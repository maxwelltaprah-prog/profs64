import Link from "next/link";
import { redirect } from "next/navigation";

import { formatCredits } from "@/components/app-header";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plan and credits" };

export default async function UpgradePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/upgrade");

  const shell = await loadShell(user.id);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={shell.balance}
        theme={shell.theme}
        email={user.email ?? ""}
        recent={shell.projects.slice(0, 8)}
        chats={shell.chats}
        active="upgrade"
      />
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-muted text-[13px]">Plan and credits</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your Buildr plan</h1>

          <section
            aria-labelledby="current-plan"
            className="border-hairline bg-surface mt-8 rounded-2xl border p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="current-plan" className="text-lg font-semibold">
                  Free plan
                </h2>
                <p className="text-muted mt-1 text-[13px]">
                  Build projects and use chat with your available credits.
                </p>
              </div>
              <span className="bg-accent-subtle text-accent rounded-full px-3 py-1 text-xs font-medium">
                Current plan
              </span>
            </div>
            <div className="border-hairline mt-5 flex items-center justify-between border-t pt-4">
              <span className="text-muted text-[13px]">Available credits</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatCredits(shell.balance)}
              </span>
            </div>
          </section>

          <section
            aria-labelledby="upgrade-status"
            className="border-hairline mt-6 rounded-2xl border p-5 sm:p-6"
          >
            <h2 id="upgrade-status" className="text-sm font-semibold">
              Paid plans and credit top-ups aren&apos;t available yet
            </h2>
            <p className="text-muted mt-2 text-[13px] leading-6">
              There is no checkout or subscription to activate right now. Buildr charges credits
              based on model usage; one credit covers $0.03 of usage. You can see your current
              balance above and keep using your existing projects and chats.
            </p>
            <Link
              href="/dashboard"
              className="press bg-accent text-accent-fg hover:bg-accent-hover mt-5 inline-flex h-9 items-center rounded-md px-4 text-[13px] font-medium"
            >
              Back to projects
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
