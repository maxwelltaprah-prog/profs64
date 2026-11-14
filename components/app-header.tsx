"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppActions } from "@/components/use-app-actions";
import { type ThemeChoice } from "@/lib/theme";

import { CommandPalette, type RunnableAction } from "./command-palette";

export function formatCredits(value: number): string {
  return value.toFixed(2);
}

export function AppHeader({
  balance,
  theme,
  extraActions = [],
  children,
}: {
  balance: number;
  theme: ThemeChoice;
  extraActions?: readonly RunnableAction[];
  children?: ReactNode;
}) {
  const { actions, signOut, signingOut } = useAppActions(extraActions);

  return (
    <header className="glass-bar border-hairline sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span aria-hidden="true" className="bg-brass size-5 rounded-md" />
          Buildr
        </Link>
        {children ? (
          <>
            <span aria-hidden="true" className="text-subtle text-xs">
              /
            </span>
            <span className="text-muted min-w-0 truncate text-[13px]">{children}</span>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <p className="border-hairline bg-surface text-muted flex h-8 items-center rounded-full border px-3 text-xs whitespace-nowrap">
          <span className="text-text font-medium tabular-nums">{formatCredits(balance)}</span>{" "}
          credits
        </p>
        <CommandPalette actions={actions} triggerClassName="touch-target" />
        <ThemeToggle initial={theme} className="touch-target" />
        <SignOutButton
          signingOut={signingOut}
          onSignOut={() => void signOut()}
          className="touch-target"
        />
      </div>
    </header>
  );
}
