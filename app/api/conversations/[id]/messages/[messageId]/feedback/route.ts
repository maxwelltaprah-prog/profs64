import { getVerifiedUser } from "@/lib/db/auth";
import { getConversation } from "@/lib/db/conversations";
import { FEEDBACK_EVENT } from "@/lib/db/outputs";
import { isUuid } from "@/lib/db/projects";
import { recordAuditEvent } from "@/lib/db/service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { notFound } from "@/lib/security/errors";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { FEEDBACK_BODY_LIMIT_BYTES, feedbackBodySchema } from "@/lib/security/schemas";

// Thumbs up, thumbs down or clear, for one assistant reply in one of the caller's conversations.
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await context.params;
  return withApi("conversations.feedback", async (_request, { requestId }) => {
    const user = await getVerifiedUser();
    if (!isUuid(id) || !isUuid(messageId)) throw notFound();
    const body = await readJson(request, feedbackBodySchema, FEEDBACK_BODY_LIMIT_BYTES);
    await enforceLimits([{ config: LIMITS.feedbackUser, key: user.id }]);

    // Ownership: RLS returns nothing for another person's conversation or message (a 404).
    const supabase = await createSupabaseServerClient();
    await getConversation(id, supabase);
    const { data } = await supabase
      .from("conversation_messages")
      .select("id")
      .eq("id", messageId)
      .eq("conversation_id", id)
      .eq("role", "assistant")
      .maybeSingle();
    if (!data) throw notFound();

    await recordAuditEvent({
      userId: user.id,
      event: FEEDBACK_EVENT,
      metadata: { conversationId: id, messageId, rating: body.rating },
      requestId,
    });
    return Response.json({ rating: body.rating === "none" ? null : body.rating });
  })(request);
}
