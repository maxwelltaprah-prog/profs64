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
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          Buildr
        </Link>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <p className="text-muted text-[13px]">
          <span className="text-text font-medium tabular-nums">{formatCredits(balance)}</span>{" "}
          credits
        </p>
        <CommandPalette actions={actions} />
        <ThemeToggle initial={theme} />
        <SignOutButton signingOut={signingOut} onSignOut={() => void signOut()} />
      </div>
    </header>
  );
}
