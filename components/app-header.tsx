"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { applyTheme, ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { nextTheme, parseTheme, THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

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
  const router = useRouter();
  const toast = useToast();

  const [signingOut, setSigningOut] = useState(false);

  // Feedback is immediate: the button shows progress and the page dims while the session ends.
  // The page is left with a full navigation so nothing from the signed-in session stays in the
  // client's memory or router cache. On failure the page comes back and says so.
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    document.documentElement.dataset["leaving"] = "true";
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");
      window.location.replace("/");
    } catch {
      delete document.documentElement.dataset["leaving"];
      setSigningOut(false);
      toast("Could not sign out. Check your connection and try again.", "error");
    }
  };

  const actions = useMemo<RunnableAction[]>(
    () => [
      ...extraActions,
      {
        id: "dashboard",
        label: "Go to projects",
        keywords: "dashboard home",
        run: () => router.push("/dashboard"),
      },
      {
        id: "theme",
        label: "Change theme",
        keywords: "light dark system appearance",
        hint: "Cycles light, dark, system",
        run: () => {
          const current = parseTheme(
            document.documentElement.getAttribute("data-theme") ??
              document.cookie
                .split("; ")
                .find((c) => c.startsWith(`${THEME_COOKIE}=`))
                ?.split("=")[1],
          );
          applyTheme(nextTheme(current));
        },
      },
      {
        id: "account",
        label: "Account and data",
        keywords: "export delete settings",
        run: () => router.push("/account"),
      },
      { id: "signout", label: "Sign out", keywords: "log out logout", run: () => void signOut() },
    ],
    // signOut only closes over stable values (toast), so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraActions, router],
  );

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
        <Button
          variant="ghost"
          size="icon"
          aria-label={signingOut ? "Signing out" : "Sign out"}
          title="Sign out"
          loading={signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? <span aria-hidden="true" className="spinner" /> : <LogOut {...iconProps} />}
        </Button>
      </div>
    </header>
  );
}
