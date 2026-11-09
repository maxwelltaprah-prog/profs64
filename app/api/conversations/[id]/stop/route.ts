import { getVerifiedUser } from "@/lib/db/auth";
import { getConversation } from "@/lib/db/conversations";
import { recordAuditEvent } from "@/lib/db/service";
import { STOP_EVENT } from "@/lib/db/stop";
import { withApi } from "@/lib/security/api";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";

// Asks the running reply in one of the caller's conversations to stop (see lib/db/stop.ts).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("agent.stop", async (_request, { requestId }) => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.stopUser, key: user.id }]);
    await getConversation(id);
    await recordAuditEvent({
      userId: user.id,
      event: STOP_EVENT,
      metadata: { conversationId: id },
      requestId,
    });
    return Response.json({ status: "ok" });
  })(request);
}
