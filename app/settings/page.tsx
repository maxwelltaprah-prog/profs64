import Link from "next/link";
import { redirect } from "next/navigation";

import { HomeSidebar } from "@/components/home/home-sidebar";
import { AppearanceSetting } from "@/components/settings/appearance-setting";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/settings");

  const shell = await loadShell(user.id);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={shell.balance}
        theme={shell.theme}
        email={user.email ?? ""}
        recent={shell.projects.slice(0, 8)}
        chats={shell.chats}
        active="settings"
      />
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-muted text-[13px]">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted mt-2 text-sm">
            Manage your appearance, sign-in and account data.
          </p>

          <section aria-label="Appearance settings" className="border-hairline mt-8 border-t pt-6">
            <AppearanceSetting initial={shell.theme} />
          </section>

          <section
            aria-labelledby="security-settings"
            className="border-hairline mt-8 border-t pt-6"
          >
            <h2 id="security-settings" className="text-sm font-medium">
              Sign-in and security
            </h2>
            <p className="text-muted mt-1 text-[13px]">
              Signed in as <span className="text-text">{user.email ?? "your account"}</span>
            </p>
            <Link
              href="/forgot-password"
              className="text-accent mt-3 inline-flex text-[13px] underline underline-offset-2"
            >
              Reset your password
            </Link>
          </section>

          <section aria-labelledby="data-settings" className="border-hairline mt-8 border-t pt-6">
            <h2 id="data-settings" className="text-sm font-medium">
              Account and data
            </h2>
            <p className="text-muted mt-1 max-w-xl text-[13px]">
              Export a copy of your projects and account data, or review account deletion options.
            </p>
            <Link
              href="/account"
              className="text-accent mt-3 inline-flex text-[13px] underline underline-offset-2"
            >
              Manage account and data
            </Link>
          </section>

          <section
            aria-labelledby="shortcuts-settings"
            className="border-hairline mt-8 border-t pt-6"
          >
            <h2 id="shortcuts-settings" className="text-sm font-medium">
              Keyboard shortcut
            </h2>
            <p className="text-muted mt-1 text-[13px]">
              Open search and actions with{" "}
              <kbd className="border-hairline rounded border px-1.5 py-0.5">Ctrl K</kbd> or{" "}
              <kbd className="border-hairline rounded border px-1.5 py-0.5">⌘ K</kbd>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
