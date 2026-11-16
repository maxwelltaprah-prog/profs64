"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppActions } from "@/components/use-app-actions";
import { formatCredits } from "@/lib/credits/math";
import { type ThemeChoice } from "@/lib/theme";

import { CommandPalette, type RunnableAction } from "./command-palette";

// Re-exported so existing client imports (sidebar, etc.) keep working.
export { formatCredits };

export function AppHeader({
  balance,
  theme,
  extraActions = [],
  trailing,
  children,
}: {
  balance: number;
  theme: ThemeChoice;
  extraActions?: readonly RunnableAction[];
  /** Buttons placed just before the credits, such as project settings. */
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  const { actions, signOut, signingOut } = useAppActions(extraActions);

  return (
    <header className="glass-bar border-hairline sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span aria-hidden="true" className="bg-brass size-5 rounded-md" />
          <span className="max-sm:sr-only">Buildr</span>
        </Link>
        {children ? (
          <>
            <span aria-hidden="true" className="text-subtle text-xs max-sm:hidden">
              /
            </span>
            <span className="text-muted flex min-w-0 flex-1 items-center gap-2 text-[13px]">
              {children}
            </span>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {trailing}
        <p className="border-hairline bg-surface text-muted flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap sm:px-3">
          <span className="text-text font-medium tabular-nums">{formatCredits(balance)}</span>
          <span className="max-sm:sr-only">credits</span>
        </p>
        <CommandPalette actions={actions} triggerClassName="touch-target" />
        <ThemeToggle initial={theme} className="touch-target max-sm:hidden" />
        <SignOutButton
          signingOut={signingOut}
          onSignOut={() => void signOut()}
          className="touch-target max-sm:hidden"
        />
      </div>
    </header>
  );
}
