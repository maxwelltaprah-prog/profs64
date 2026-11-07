import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DeleteAccount } from "@/components/account/delete-account";
import { AppHeader } from "@/components/app-header";
import { getOptionalUser } from "@/lib/db/auth";
import { getCreditBalance } from "@/lib/db/projects";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/account");
  const [balance, store] = await Promise.all([getCreditBalance(user.id), cookies()]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader balance={balance} theme={parseTheme(store.get(THEME_COOKIE)?.value)} />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted mt-1 text-[13px]">{user.email}</p>

        <section aria-labelledby="export" className="mt-8">
          <h2 id="export" className="text-sm font-medium">
            Export your data
          </h2>
          <p className="text-muted mt-1 text-[13px]">
            Download your profile, projects, files, messages, credit history and security log as one
            JSON file.
          </p>
          <p className="mt-3">
            <a
              href="/api/account/export"
              download
              className="text-accent text-[13px] underline underline-offset-2"
            >
              Download buildr-export.json
            </a>
          </p>
        </section>

        <section aria-labelledby="delete" className="mt-10">
          <h2 id="delete" className="text-sm font-medium">
            Delete your account
          </h2>
          <p className="text-muted mt-1 mb-4 max-w-lg text-[13px]">
            This permanently deletes your projects, files and messages. Credit and security records
            are kept without your identity, for accounting. This cannot be undone.
          </p>
          <DeleteAccount />
        </section>
      </main>
    </div>
  );
}
