import { cookies } from "next/headers";
import { notFound as nextNotFound, redirect } from "next/navigation";

import { ProjectHeader } from "@/components/workspace/project-header";
import { Workspace } from "@/components/workspace/workspace";
import { toUiMessages } from "@/lib/ai/messages";
import { getOptionalUser } from "@/lib/db/auth";
import { listRatings, outputsFor } from "@/lib/db/outputs";
import { getCreditBalance, getProject, listMessages, listProjectFiles } from "@/lib/db/projects";
import { getProjectShareSlug } from "@/lib/db/share";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/security/errors";
import { isStarterUntouched } from "@/lib/templates/vite-react-starter";
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

  const supabase = await createSupabaseServerClient();
  const [files, messages, balance, store, ratings, share, created] = await Promise.all([
    listProjectFiles(id, supabase),
    listMessages(id, supabase),
    getCreditBalance(user.id, supabase),
    cookies(),
    listRatings(id, supabase),
    getProjectShareSlug(id, supabase),
    supabase.from("projects").select("created_at").eq("id", id).maybeSingle(),
  ]);
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ProjectHeader
        balance={balance}
        theme={theme}
        projectId={id}
        name={project.name}
        createdAt={(created.data as { created_at?: string } | null)?.created_at ?? null}
        ownerEmail={user.email ?? ""}
        built={!isStarterUntouched(files)}
        shareSlug={share.slug}
        shareAvailable={share.available}
      />
      <main id="main" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Workspace
          userId={user.id}
          projectId={id}
          projectName={project.name}
          files={files}
          messages={toUiMessages(messages, 2000)}
          outputs={outputsFor(messages, ratings)}
          balance={balance}
          canUseAssistant={Boolean(user.email_confirmed_at)}
        />
      </main>
    </div>
  );
}
