import { auditBestEffort } from "@/lib/db/audit";
import { getOptionalUser } from "@/lib/db/auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";

export const POST = withApi("auth.logout", async (_request, { requestId }) => {
  const user = await getOptionalUser();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  if (user) await auditBestEffort({ userId: user.id, event: "logout", requestId });
  return Response.json({ status: "ok" });
});
