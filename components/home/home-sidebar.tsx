"use client";

import { ArrowUpRight, House, MessageSquare, Plus, Settings2, UserRound, Zap } from "lucide-react";
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

// The signed-in app rail: navigation, recent work, credits, upgrade, settings and account actions.
// Below the md breakpoint it collapses to a compact top bar.
export function HomeSidebar({
  balance,
  theme,
  email,
  recent,
  chats = [],
  active = "home",
}: {
  balance: number;
  theme: ThemeChoice;
  email: string;
  recent: ReadonlyArray<{ id: string; name: string }>;
  chats?: ReadonlyArray<{ id: string; title: string }>;
  /** Which page is showing: home, a chat, or a specific conversation (its id). */
  active?: "home" | "chat" | string;
}) {
  const { actions, signOut, signingOut } = useAppActions();

  return (
    <aside className="glass-bar border-hairline sticky top-0 z-20 flex items-center gap-2 border-b px-3 py-2 md:h-dvh md:w-64 md:shrink-0 md:flex-col md:items-stretch md:border-r md:border-b-0 md:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none md:flex-col md:items-stretch md:gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-1 py-1 text-sm font-semibold tracking-tight"
        >
          <span aria-hidden="true" className="bg-brass size-5 rounded-md" />
          Buildr
        </Link>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link
            href="/upgrade"
            aria-label="Upgrade"
            className="press text-accent hover:bg-accent-subtle flex size-8 items-center justify-center rounded-md md:hidden"
          >
            <Zap {...iconProps} />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="press text-muted hover:bg-surface-2 hover:text-text flex size-8 items-center justify-center rounded-md md:hidden"
          >
            <Settings2 {...iconProps} />
          </Link>
          <CommandPalette actions={actions} triggerClassName="md:w-full" />
        </div>
      </div>

      <nav aria-label="Main" className="mt-3 hidden flex-col gap-0.5 md:flex">
        {active === "home" ? (
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
        ) : (
          <Link href="/dashboard" className={item}>
            <Plus {...iconProps} />
            New project
          </Link>
        )}
        <Link
          href="/chat"
          aria-current={active === "chat" ? "page" : undefined}
          className={`${item} ${active === "chat" ? "bg-surface-2 text-text" : ""}`}
        >
          <MessageSquare {...iconProps} />
          New chat
        </Link>
        <Link
          href="/dashboard"
          aria-current={active === "home" ? "page" : undefined}
          className={`${item} ${active === "home" ? "bg-surface-2 text-text" : ""}`}
        >
          <House {...iconProps} />
          Home
        </Link>
        <Link
          href="/settings"
          aria-current={active === "settings" ? "page" : undefined}
          className={`${item} ${active === "settings" ? "bg-surface-2 text-text" : ""}`}
        >
          <Settings2 {...iconProps} />
          Settings
        </Link>
        <Link href="/account" className={item}>
          <UserRound {...iconProps} />
          Account and data
        </Link>
      </nav>

      <div className="mt-5 hidden min-h-0 flex-col gap-4 overflow-y-auto md:flex">
        {chats.length > 0 ? (
          <div className="flex flex-col">
            <p className="text-subtle px-2.5 pb-1.5 text-xs font-medium">Chats</p>
            <ul className="flex flex-col gap-0.5">
              {chats.map((chat) => (
                <li key={chat.id}>
                  <Link
                    href={`/chat/${chat.id}`}
                    title={chat.title}
                    aria-current={active === chat.id ? "page" : undefined}
                    className={`${item} block truncate leading-8 ${active === chat.id ? "bg-surface-2 text-text" : ""}`}
                  >
                    {chat.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {recent.length > 0 ? (
          <div className="flex flex-col">
            <p className="text-subtle px-2.5 pb-1.5 text-xs font-medium">Projects</p>
            <ul className="flex flex-col gap-0.5">
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
      </div>

      <div className="hidden flex-1 md:block" />

      <div className="border-hairline bg-surface ring-line hidden rounded-xl p-3 md:block">
        <p className="text-muted text-xs">Credits</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCredits(balance)}</p>
        <p className="text-subtle mt-1 text-xs leading-4">Charged by the tokens each reply uses.</p>
      </div>

      <Link
        href="/upgrade"
        aria-current={active === "upgrade" ? "page" : undefined}
        className={`press mb-1 hidden h-9 items-center justify-between rounded-md px-2.5 text-[13px] font-medium md:mb-0 md:flex ${active === "upgrade" ? "bg-accent-subtle text-accent" : "bg-accent text-accent-fg hover:bg-accent-hover"}`}
      >
        <span className="flex items-center gap-2">
          <Zap {...iconProps} />
          Upgrade
        </span>
        <ArrowUpRight {...iconProps} size={14} />
      </Link>

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
