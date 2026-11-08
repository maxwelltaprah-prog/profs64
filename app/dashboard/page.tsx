import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { CreateProject } from "@/components/dashboard/create-project";
import { getOptionalUser } from "@/lib/db/auth";
import { getCreditBalance, listProjects } from "@/lib/db/projects";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projects" };

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export default async function DashboardPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/dashboard");

  const [projects, balance, store] = await Promise.all([
    listProjects(),
    getCreditBalance(user.id),
    cookies(),
  ]);
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader balance={balance} theme={theme} />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {!user.email_confirmed_at ? (
          <p
            role="status"
            className="border-hairline bg-accent-subtle mb-6 rounded-md border px-3 py-2 text-[13px]"
          >
            Confirm your email address to use the assistant. You can still create projects and
            browse files.
          </p>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <CreateProject />
        </div>

        {projects.length === 0 ? (
          <div className="border-hairline-strong mt-8 rounded-lg border border-dashed p-10">
            <h2 className="text-sm font-medium">No projects yet</h2>
            <p className="text-muted mt-1 max-w-md text-[13px]">
              Name a project above. It starts from a Vite, React, Tailwind and shadcn/ui template,
              and the assistant edits those files when you describe what to build. The preview shows
              the running app as it changes.
            </p>
          </div>
        ) : (
          <ul className="divide-hairline border-hairline bg-surface mt-8 divide-y rounded-lg border">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/project/${project.id}`}
                  className="transition-ui hover:bg-surface-2 flex items-center justify-between gap-4 px-4 py-3 first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="truncate text-sm font-medium">{project.name}</span>
                  <span className="text-muted shrink-0 text-xs tabular-nums">
                    Updated {dateFormat.format(new Date(project.updatedAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
