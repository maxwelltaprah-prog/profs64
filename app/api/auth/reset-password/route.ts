import { getOptionalUser } from "@/lib/db/auth";
import { recordAuditEvent } from "@/lib/db/service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { badRequest, unauthenticated, weakPassword } from "@/lib/security/errors";
import { logger } from "@/lib/security/logger";
import {
  checkBreachedPassword,
  checkPasswordPolicy,
  passwordProblemMessage,
} from "@/lib/security/password";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { AUTH_BODY_LIMIT_BYTES, resetPasswordSchema } from "@/lib/security/schemas";

// Requires the short-lived session created by the emailed recovery link.
export const POST = withApi("auth.reset-password", async (request, { requestId }) => {
  const user = await getOptionalUser();
  if (!user?.email) throw unauthenticated();
  await enforceLimits([{ config: LIMITS.passwordChangeUser, key: user.id }]);

  const { password } = await readJson(request, resetPasswordSchema, AUTH_BODY_LIMIT_BYTES);
  const problem = checkPasswordPolicy(password, user.email);
  if (problem) throw weakPassword(passwordProblemMessage(problem));
  if ((await checkBreachedPassword(password)) === "breached") {
    throw weakPassword(passwordProblemMessage("breached"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    logger.warn("password_update_rejected", { requestId, code: error.code ?? "unknown" });
    throw badRequest("We could not update the password. Request a new reset link and try again.");
  }

  try {
    await recordAuditEvent({ userId: user.id, event: "password_changed", requestId });
  } catch (auditError) {
    logger.error("audit_write_failed", { requestId, error: auditError });
  }
  return Response.json({ status: "ok" });
});
