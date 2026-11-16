import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/security/errors";

// A shared project's public preview: its name and files, read through the security-definer
// get_shared_project function (returns nothing unless the project has a share_slug). Used by the
// public /p/[slug] page, which has no signed-in user.
export interface SharedProject {
  name: string;
  files: Array<{ path: string; content: string }>;
}

export async function getSharedProject(
  slug: string,
  supabase: SupabaseClient,
): Promise<SharedProject | null> {
  const { data, error } = await supabase.rpc("get_shared_project", { p_slug: slug });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { name?: unknown; files?: unknown };
  const files = Array.isArray(row.files)
    ? row.files
        .filter(
          (file): file is { path: string; content: string } =>
            typeof file === "object" &&
            file !== null &&
            typeof (file as { path?: unknown }).path === "string" &&
            typeof (file as { content?: unknown }).content === "string",
        )
        .map((file) => ({ path: file.path, content: file.content }))
    : [];
  return { name: typeof row.name === "string" ? row.name : "Shared project", files };
}

// The current share slug for an owned project, or null. Reads defensively: before the share
// migration the column does not exist, in which case sharing is reported as unavailable.
export async function getProjectShareSlug(
  projectId: string,
  supabase: SupabaseClient,
): Promise<{ slug: string | null; available: boolean }> {
  const { data, error } = await supabase
    .from("projects")
    .select("share_slug")
    .eq("id", projectId)
    .maybeSingle();
  if (error) return { slug: null, available: false };
  const slug = (data as { share_slug?: string | null } | null)?.share_slug ?? null;
  return { slug, available: true };
}

const SHARING_UNAVAILABLE = new AppError(
  409,
  "sharing_unavailable",
  "Sharing isn't available yet. The latest database update needs to be applied.",
);

// Turns sharing on for an owned project, returning the slug. An existing slug is kept so the link
// is stable. Pre-migration (missing column) surfaces as a clear 409 rather than a 500.
export async function enableShare(projectId: string, supabase: SupabaseClient): Promise<string> {
  const current = await getProjectShareSlug(projectId, supabase);
  if (!current.available) throw SHARING_UNAVAILABLE;
  if (current.slug) return current.slug;
  const slug = crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase
    .from("projects")
    .update({ share_slug: slug })
    .eq("id", projectId);
  if (error) throw SHARING_UNAVAILABLE;
  return slug;
}

export async function disableShare(projectId: string, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ share_slug: null })
    .eq("id", projectId);
  if (error) throw SHARING_UNAVAILABLE;
}
