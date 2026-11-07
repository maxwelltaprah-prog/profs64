import { cookies } from "next/headers";
import { notFound as nextNotFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Workspace } from "@/components/workspace/workspace";
import { getOptionalUser } from "@/lib/db/auth";
import { getCreditBalance, getProject, listMessages, listProjectFiles } from "@/lib/db/projects";
import { AppError } from "@/lib/security/errors";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user) redirect(`/login?next=/project/${encodeURIComponent(id)}`);

  let project;
  try {
    project = await getProject(id);
  } catch (error) {
    // A project owned by someone else looks exactly like one that does not exist.
    if (error instanceof AppError && error.status === 404) nextNotFound();
    throw error;
  }

  const [files, messages, balance, store] = await Promise.all([
    listProjectFiles(id),
    listMessages(id),
    getCreditBalance(user.id),
    cookies(),
  ]);
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader balance={balance} theme={theme}>
        <span className="text-muted truncate text-[13px]">{project.name}</span>
      </AppHeader>
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        <Workspace
          userId={user.id}
          projectId={id}
          files={files}
          messages={messages}
          canUseAssistant={Boolean(user.email_confirmed_at)}
        />
      </main>
    </div>
  );
}
