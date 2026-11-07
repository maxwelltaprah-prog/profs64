import { getOptionalUser } from "@/lib/db/auth";
import { recordAuditEvent } from "@/lib/db/service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { logger } from "@/lib/security/logger";

export const POST = withApi("auth.logout", async (_request, { requestId }) => {
  const user = await getOptionalUser();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  if (user) {
    try {
      await recordAuditEvent({ userId: user.id, event: "logout", requestId });
    } catch (error) {
      logger.error("audit_write_failed", { requestId, error });
    }
  }
  return Response.json({ status: "ok" });
});
