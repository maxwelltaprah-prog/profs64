import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateProject } from "@/components/dashboard/create-project";
import { HOME_PROMPT_ID, HomeSidebar } from "@/components/home/home-sidebar";
import { StartIdeas } from "@/components/home/start-ideas";
import { PromptBox } from "@/components/landing/prompt-box";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";
import { PASSWORD_MIN } from "@/lib/security/limits";
import { greetingName, timeAgo } from "@/lib/workspace/home";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

const RECENT_IN_SIDEBAR = 8;

export default async function DashboardPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/dashboard");

  const { projects, balance, theme, chats } = await loadShell(user.id);
  const name = greetingName(user.email);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={balance}
        theme={theme}
        email={user.email ?? ""}
        recent={projects
          .slice(0, RECENT_IN_SIDEBAR)
          .map(({ id, name: title }) => ({ id, name: title }))}
        chats={chats}
        active="home"
      />
      <main id="main" className="min-w-0 flex-1 px-6 pt-12 pb-16 md:px-10 md:pt-20">
        <div className="mx-auto w-full max-w-3xl">
          {!user.email_confirmed_at ? (
            <p
              role="status"
              className="border-hairline bg-accent-subtle mb-6 rounded-lg border px-3 py-2 text-[13px]"
            >
              Confirm your email address to use the assistant. You can still create projects and
              browse files.
            </p>
          ) : null}

          <h1 className="rise text-center text-[28px] leading-tight font-semibold tracking-[-0.02em] text-balance md:text-[34px]">
            {name ? `${name}, what are we building today?` : "What are we building today?"}
          </h1>
          <nav aria-label="Mode" className="rise rise-1 mt-6 flex justify-center">
            <div className="border-hairline bg-surface-2 inline-flex rounded-full border p-1 text-[13px] font-medium">
              <span
                aria-current="page"
                className="bg-surface text-text rounded-full px-4 py-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
              >
                Build an app
              </span>
              <Link
                href="/chat"
                className="press text-muted hover:text-text rounded-full px-4 py-1.5"
              >
                Chat and documents
              </Link>
            </div>
          </nav>
          <div className="rise rise-1 mt-5">
            <PromptBox
              signedIn
              passwordMin={PASSWORD_MIN}
              inputId={HOME_PROMPT_ID}
              showExamples={false}
            />
          </div>

          <section aria-labelledby="recent-title" className="rise rise-2 mt-14">
            <h2 id="recent-title" className="text-muted text-[13px] font-medium">
              Recent projects
            </h2>
            {projects.length === 0 ? (
              <p className="border-hairline-strong text-muted mt-3 rounded-xl border border-dashed p-6 text-[13px]">
                Nothing here yet. Describe an app above, or start from one of the ideas below.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/project/${project.id}`}
                      className="press border-hairline bg-surface hover:border-hairline-strong hover:bg-surface-2 flex flex-col gap-1 rounded-xl border px-4 py-3"
                    >
                      <span className="truncate text-sm font-medium" title={project.name}>
                        {project.name}
                      </span>
                      <span className="text-muted text-xs">
                        Updated {timeAgo(project.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="start-title"
            className="rise rise-3 border-hairline bg-surface-2 mt-14 rounded-2xl border p-4 sm:p-5"
          >
            <h2 id="start-title" className="text-sm font-semibold tracking-tight">
              Start from an idea
            </h2>
            <p className="text-muted mt-0.5 text-[13px]">
              Pick one to fill the box above, then change the details before you send it.
            </p>
            <div className="mt-4">
              <StartIdeas />
            </div>
            <div className="border-hairline mt-5 border-t pt-4">
              <p className="text-muted mb-2 text-[13px]">
                Or start a blank project from the template.
              </p>
              <CreateProject />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
