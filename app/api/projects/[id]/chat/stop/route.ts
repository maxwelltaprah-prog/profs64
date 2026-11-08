import { getVerifiedUser } from "@/lib/db/auth";
import { getProject, isUuid } from "@/lib/db/projects";
import { recordAuditEvent } from "@/lib/db/service";
import { STOP_EVENT } from "@/lib/db/stop";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { notFound } from "@/lib/security/errors";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";

// Asks the running reply in one of the caller's projects to stop. There is no body: the project in
// the path is the only input. The chat request itself notices the event and ends the model call.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("chat.stop", async (_request, { requestId }) => {
    const user = await getVerifiedUser();
    if (!isUuid(id)) throw notFound();
    await enforceLimits([{ config: LIMITS.stopUser, key: user.id }]);

    // Ownership: RLS returns nothing for another person's project, which is a 404.
    await getProject(id, await createSupabaseServerClient());
    await recordAuditEvent({
      userId: user.id,
      event: STOP_EVENT,
      metadata: { projectId: id },
      requestId,
    });
    return Response.json({ status: "ok" });
  })(request);
}
