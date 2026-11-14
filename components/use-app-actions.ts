"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { applyTheme } from "@/components/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { nextTheme, parseTheme, THEME_COOKIE } from "@/lib/theme";

import { type RunnableAction } from "./command-palette";

// The commands every signed-in screen offers (palette entries) and sign out, shared by the top
// header and the home sidebar so both behave the same.
export function useAppActions(extraActions: readonly RunnableAction[] = []) {
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
        id: "settings",
        label: "Settings",
        keywords: "preferences appearance profile",
        run: () => router.push("/settings"),
      },
      {
        id: "account",
        label: "Account and data",
        keywords: "export delete privacy",
        run: () => router.push("/account"),
      },
      {
        id: "upgrade",
        label: "Plan and credits",
        keywords: "upgrade billing credits",
        run: () => router.push("/upgrade"),
      },
      { id: "signout", label: "Sign out", keywords: "log out logout", run: () => void signOut() },
    ],
    // signOut only closes over stable values (toast), so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraActions, router],
  );

  return { actions, signOut, signingOut };
}
