import { redirect } from "next/navigation";

import { HomeSidebar } from "@/components/home/home-sidebar";
import { LibraryView } from "@/components/library/library-view";
import { getOptionalUser } from "@/lib/db/auth";
import { loadLibrary } from "@/lib/db/library";
import { loadShell } from "@/lib/db/shell";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your library" };

export default async function LibraryPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/library");
  const [shell, library] = await Promise.all([loadShell(user.id), loadLibrary()]);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={shell.balance}
        theme={shell.theme}
        email={user.email ?? ""}
        recent={shell.projects.slice(0, 8)}
        chats={shell.chats}
        active="library"
      />
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-muted text-[13px]">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your library</h1>
          <p className="text-muted mt-2 text-sm">
            Search, rename, pin and delete your projects and chats.
          </p>
          <div className="mt-8">
            <LibraryView
              projects={library.projects}
              chats={library.chats}
              pinsEnabled={library.pinsEnabled}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
