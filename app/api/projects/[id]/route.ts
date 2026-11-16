import { getVerifiedUser } from "@/lib/db/auth";
import { getProject, translateDbError } from "@/lib/db/projects";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { PROJECT_BODY_LIMIT_BYTES } from "@/lib/security/limits";
import { readJson } from "@/lib/security/request";
import { projectUpdateSchema } from "@/lib/security/schemas";

type Context = { params: Promise<{ id: string }> };

// Rename and/or pin a project. Ownership comes from RLS: someone else's project is a 404.
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("projects.update", async () => {
    await getVerifiedUser();
    const body = await readJson(request, projectUpdateSchema, PROJECT_BODY_LIMIT_BYTES);
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch["name"] = body.name;
    if (body.pinned !== undefined)
      patch["pinned_at"] = body.pinned ? new Date().toISOString() : null;
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if (error) throw translateDbError(error);
    return Response.json({ project: { id } });
  })(request);
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("projects.delete", async () => {
    await getVerifiedUser();
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw translateDbError(error);
    return new Response(null, { status: 204 });
  })(request);
}
