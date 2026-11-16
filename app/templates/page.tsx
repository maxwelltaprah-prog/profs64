import { redirect } from "next/navigation";

import { HomeSidebar } from "@/components/home/home-sidebar";
import { TemplateGallery } from "@/components/home/template-gallery";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/templates");
  const shell = await loadShell(user.id);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={shell.balance}
        theme={shell.theme}
        email={user.email ?? ""}
        recent={shell.projects.slice(0, 8)}
        chats={shell.chats}
        active="templates"
      />
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-5xl">
          <p className="page-in text-muted text-[13px]">Start faster</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-muted mt-2 text-sm">
            Pick a template to create a project and start building it right away. You can change
            anything from the chat once it opens.
          </p>
          <div className="mt-8">
            <TemplateGallery />
          </div>
        </div>
      </main>
    </div>
  );
}
