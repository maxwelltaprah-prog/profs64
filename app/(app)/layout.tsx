import { redirect } from "next/navigation";

import { HomeSidebar } from "@/components/home/home-sidebar";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";

import type { ReactNode } from "react";

// The signed-in shell. The sidebar lives here, not in each page, so moving between pages swaps only
// the content beside it: the sidebar is never re-rendered or remounted by navigation. The proxy
// already sends signed-out visitors to the login page; this is the second check.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  const shell = await loadShell(user.id);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={shell.balance}
        theme={shell.theme}
        email={user.email ?? ""}
        recent={shell.projects.slice(0, 8)}
        chats={shell.chats}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
