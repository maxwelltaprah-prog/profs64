import { getVerifiedUser } from "@/lib/db/auth";
import { getConversation } from "@/lib/db/conversations";
import { translateDbError } from "@/lib/db/projects";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { PROJECT_BODY_LIMIT_BYTES } from "@/lib/security/limits";
import { readJson } from "@/lib/security/request";
import { conversationRenameSchema } from "@/lib/security/schemas";

type Context = { params: Promise<{ id: string }> };

// Rename. Ownership: RLS makes another person's conversation a 404.
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("conversations.rename", async () => {
    await getVerifiedUser();
    const body = await readJson(request, conversationRenameSchema, PROJECT_BODY_LIMIT_BYTES);
    const supabase = await createSupabaseServerClient();
    await getConversation(id, supabase);
    const { error } = await supabase
      .from("conversations")
      .update({ title: body.title, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw translateDbError(error);
    return Response.json({ conversation: { id, title: body.title } });
  })(request);
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("conversations.delete", async () => {
    await getVerifiedUser();
    const supabase = await createSupabaseServerClient();
    await getConversation(id, supabase);
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) throw translateDbError(error);
    return new Response(null, { status: 204 });
  })(request);
}
