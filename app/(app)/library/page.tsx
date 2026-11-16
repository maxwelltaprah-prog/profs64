import { redirect } from "next/navigation";

import { LibraryView } from "@/components/library/library-view";
import { getOptionalUser } from "@/lib/db/auth";
import { loadLibrary } from "@/lib/db/library";
import { timeAgo } from "@/lib/workspace/home";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your library" };

export default async function LibraryPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/library");
  const library = await loadLibrary();

  return (
    <>
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-5xl">
          <p className="page-in text-muted text-[13px]">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your library</h1>
          <p className="text-muted mt-2 text-sm">
            Search, rename, pin and delete your projects and chats.
          </p>
          <div className="mt-8">
            <LibraryView
              projects={library.projects.map((project) => ({
                ...project,
                updatedLabel: timeAgo(project.updatedAt),
              }))}
              chats={library.chats}
              pinsEnabled={library.pinsEnabled}
            />
          </div>
        </div>
      </main>
    </>
  );
}
