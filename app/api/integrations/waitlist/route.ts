import { getVerifiedUser } from "@/lib/db/auth";
import { recordAuditEvent } from "@/lib/db/service";
import { withApi } from "@/lib/security/api";
import { PROJECT_BODY_LIMIT_BYTES } from "@/lib/security/limits";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { integrationInterestSchema } from "@/lib/security/schemas";

// Records interest in an integration that is not available yet. Stores the integration id and
// nothing else, as an audit event, so no new table is needed.
export const POST = withApi("integrations.interest", async (request, { requestId }) => {
  const user = await getVerifiedUser();
  await enforceLimits([{ config: LIMITS.waitlistUser, key: user.id }]);
  const body = await readJson(request, integrationInterestSchema, PROJECT_BODY_LIMIT_BYTES);
  await recordAuditEvent({
    userId: user.id,
    event: "integration_interest",
    metadata: { integration: body.integration },
    requestId,
  });
  return Response.json({ status: "ok", integration: body.integration });
});
