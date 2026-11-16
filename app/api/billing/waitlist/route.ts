import { getVerifiedUser } from "@/lib/db/auth";
import { recordAuditEvent } from "@/lib/db/service";
import { withApi } from "@/lib/security/api";
import { PROJECT_BODY_LIMIT_BYTES } from "@/lib/security/limits";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { waitlistBodySchema } from "@/lib/security/schemas";

// Records interest in a credit pack. There is no checkout yet, so this only logs that the person
// asked to be told when top-ups go live. It stores a pack id and nothing else.
export const POST = withApi("billing.waitlist", async (request, { requestId }) => {
  const user = await getVerifiedUser();
  await enforceLimits([{ config: LIMITS.waitlistUser, key: user.id }]);
  const body = await readJson(request, waitlistBodySchema, PROJECT_BODY_LIMIT_BYTES);
  await recordAuditEvent({
    userId: user.id,
    event: "pack_waitlist",
    metadata: { pack: body.pack },
    requestId,
  });
  return Response.json({ status: "ok", pack: body.pack });
});
