import { getVerifiedUser } from "@/lib/db/auth";
import { getProject } from "@/lib/db/projects";
import { disableShare, enableShare } from "@/lib/db/share";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";

type Context = { params: Promise<{ id: string }> };

// Turn a project's public preview link on. Ownership comes from RLS (getProject 404s otherwise).
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("projects.share.enable", async () => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.shareUser, key: user.id }]);
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    const slug = await enableShare(id, supabase);
    return Response.json({ slug, path: `/p/${slug}` });
  })(request);
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("projects.share.disable", async () => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.shareUser, key: user.id }]);
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    await disableShare(id, supabase);
    return new Response(null, { status: 204 });
  })(request);
}
