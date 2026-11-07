import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { appBaseUrl } from "@/lib/security/app-url";
import { getClientIp, hashForKey } from "@/lib/security/client-ip";
import { logger } from "@/lib/security/logger";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { AUTH_BODY_LIMIT_BYTES, forgotPasswordSchema } from "@/lib/security/schemas";

export const POST = withApi("auth.forgot-password", async (request, { requestId }) => {
  await enforceLimits([{ config: LIMITS.resetIp, key: hashForKey(getClientIp(request.headers)) }]);
  const { email } = await readJson(request, forgotPasswordSchema, AUTH_BODY_LIMIT_BYTES);
  await enforceLimits([{ config: LIMITS.resetAccount, key: hashForKey(email) }]);

  const base = appBaseUrl(request);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    base ? { redirectTo: `${base}/auth/callback?next=/reset-password` } : {},
  );
  if (error)
    logger.warn("password_reset_request_failed", { requestId, code: error.code ?? "unknown" });

  // Identical answer whether or not the address exists, and whether or not sending failed.
  return Response.json({ status: "check_email" }, { status: 202 });
});
