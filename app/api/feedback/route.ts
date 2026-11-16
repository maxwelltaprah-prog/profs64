import { getVerifiedUser } from "@/lib/db/auth";
import { insertFeedback } from "@/lib/db/service";
import { withApi } from "@/lib/security/api";
import { TESTER_FEEDBACK_BODY_LIMIT_BYTES } from "@/lib/security/limits";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { testerFeedbackSchema } from "@/lib/security/schemas";

// Feedback from a beta tester. Stored with their user id so it can be followed up and deleted with
// the account. Only the message and the page path are kept.
export const POST = withApi("feedback.create", async (request) => {
  const user = await getVerifiedUser();
  await enforceLimits([{ config: LIMITS.testerFeedbackUser, key: user.id }]);
  const body = await readJson(request, testerFeedbackSchema, TESTER_FEEDBACK_BODY_LIMIT_BYTES);
  await insertFeedback({ userId: user.id, message: body.message, page: body.page ?? null });
  return Response.json({ status: "ok" }, { status: 201 });
});
