"use client";

import { House, Plus, UserRound } from "lucide-react";
import Link from "next/link";

import { formatCredits } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { iconProps } from "@/components/ui/icons";
import { useAppActions } from "@/components/use-app-actions";
import { type ThemeChoice } from "@/lib/theme";

export const HOME_PROMPT_ID = "home-prompt";

const item =
  "press text-muted hover:bg-surface-2 hover:text-text flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px]";

// The home screen's left rail: new project, home, account, recent projects, credits, theme and
// sign out. Below the md breakpoint it collapses to a top bar with the brand, search, theme and
// sign out; the rest of its content is on the page itself. Each control is rendered once, so the
// palette's keyboard shortcut is registered once.
export function HomeSidebar({
  balance,
  theme,
  email,
  recent,
}: {
  balance: number;
  theme: ThemeChoice;
  email: string;
  recent: ReadonlyArray<{ id: string; name: string }>;
}) {
  const { actions, signOut, signingOut } = useAppActions();

  return (
    <aside className="glass-bar border-hairline sticky top-0 z-20 flex items-center gap-2 border-b px-3 py-2 md:h-dvh md:w-64 md:shrink-0 md:flex-col md:items-stretch md:border-r md:border-b-0 md:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none md:flex-col md:items-stretch md:gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-1 py-1 text-sm font-semibold tracking-tight"
        >
          <span aria-hidden="true" className="bg-accent size-5 rounded-md" />
          Buildr
        </Link>
        <div className="ml-auto md:ml-0">
          <CommandPalette actions={actions} triggerClassName="md:w-full" />
        </div>
      </div>

      <nav aria-label="Main" className="mt-3 hidden flex-col gap-0.5 md:flex">
        <button
          type="button"
          className={item}
          onClick={() => {
            const box = document.getElementById(HOME_PROMPT_ID);
            box?.scrollIntoView({ block: "center", behavior: "smooth" });
            box?.focus({ preventScroll: true });
          }}
        >
          <Plus {...iconProps} />
          New project
        </button>
        <Link href="/dashboard" aria-current="page" className={`${item} bg-surface-2 text-text`}>
          <House {...iconProps} />
          Home
        </Link>
        <Link href="/account" className={item}>
          <UserRound {...iconProps} />
          Account and data
        </Link>
      </nav>

      {recent.length > 0 ? (
        <div className="mt-5 hidden min-h-0 flex-col md:flex">
          <p className="text-subtle px-2.5 pb-1.5 text-xs font-medium">Recent</p>
          <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {recent.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/project/${project.id}`}
                  title={project.name}
                  className={`${item} block truncate leading-8`}
                >
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="hidden flex-1 md:block" />

      <div className="border-hairline bg-surface ring-line hidden rounded-xl p-3 md:block">
        <p className="text-muted text-xs">Credits</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCredits(balance)}</p>
        <p className="text-subtle mt-1 text-xs leading-4">Charged by the tokens each reply uses.</p>
      </div>

      <div className="border-hairline flex items-center gap-1 md:mt-3 md:border-t md:pt-3">
        <p
          className="text-muted hidden min-w-0 flex-1 truncate px-1 text-xs md:block"
          title={email}
        >
          {email}
        </p>
        <ThemeToggle initial={theme} />
        <SignOutButton signingOut={signingOut} onSignOut={() => void signOut()} />
      </div>
    </aside>
  );
}
