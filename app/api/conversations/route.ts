import { getVerifiedUser } from "@/lib/db/auth";
import { createConversation, listConversations } from "@/lib/db/conversations";
import { withApi } from "@/lib/security/api";
import { PROJECT_BODY_LIMIT_BYTES } from "@/lib/security/limits";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { conversationCreateSchema } from "@/lib/security/schemas";

export const GET = withApi("conversations.list", async () => {
  await getVerifiedUser();
  return Response.json({ conversations: await listConversations() });
});

export const POST = withApi("conversations.create", async (request) => {
  const user = await getVerifiedUser();
  await enforceLimits([{ config: LIMITS.conversationCreateUser, key: user.id }]);
  const body = await readJson(request, conversationCreateSchema, PROJECT_BODY_LIMIT_BYTES);
  const conversation = await createConversation(user.id, body.title);
  return Response.json({ conversation }, { status: 201 });
});
