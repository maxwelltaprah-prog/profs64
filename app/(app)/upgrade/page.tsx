import Link from "next/link";
import { redirect } from "next/navigation";

import { PricingPlans } from "@/components/billing/pricing-plans";
import { formatCredits, USD_PER_CREDIT } from "@/lib/credits/math";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";
import { joinedPacks } from "@/lib/db/waitlist";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plan and credits" };

export default async function UpgradePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/upgrade");

  const [shell, joined] = await Promise.all([loadShell(user.id), joinedPacks()]);

  return (
    <>
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-4xl">
          <p className="text-muted text-[13px]">Plan and credits</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Credits and top-ups</h1>

          <section
            aria-labelledby="current-plan"
            className="border-hairline bg-surface mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 sm:p-6"
          >
            <div>
              <h2 id="current-plan" className="text-lg font-semibold">
                Free plan
              </h2>
              <p className="text-muted mt-1 text-[13px]">
                You started with 20 credits. Credits are spent on model usage as you build and chat.
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted text-[13px]">Available credits</p>
              <p className="text-2xl font-semibold tabular-nums">{formatCredits(shell.balance)}</p>
            </div>
          </section>

          <section aria-labelledby="packs" className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="packs" className="text-lg font-semibold tracking-tight">
                  Top up with a credit pack
                </h2>
                <p className="text-muted mt-1 text-[13px]">
                  One credit covers ${USD_PER_CREDIT.toFixed(2)} of model usage. Bigger packs
                  include more credits per dollar.
                </p>
              </div>
            </div>
            <PricingPlans joined={joined} />
            <p className="text-subtle mt-4 text-xs leading-5">
              Checkout isn&apos;t live yet, so nothing is charged. Choose a pack to be notified when
              top-ups open — you&apos;ll keep all the credits you already have in the meantime.
            </p>
          </section>

          <div className="mt-8">
            <Link
              href="/dashboard"
              className="text-muted hover:text-text text-[13px] underline underline-offset-4"
            >
              Back to projects
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
