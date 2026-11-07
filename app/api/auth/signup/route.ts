import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { appBaseUrl } from "@/lib/security/app-url";
import { getClientIp, hashForKey } from "@/lib/security/client-ip";
import { badRequest } from "@/lib/security/errors";
import { logger } from "@/lib/security/logger";
import { assertPasswordAcceptable } from "@/lib/security/password-guard";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { AUTH_BODY_LIMIT_BYTES, signupSchema } from "@/lib/security/schemas";

export const POST = withApi("auth.signup", async (request, { requestId }) => {
  await enforceLimits([{ config: LIMITS.signupIp, key: hashForKey(getClientIp(request.headers)) }]);
  const { email, password } = await readJson(request, signupSchema, AUTH_BODY_LIMIT_BYTES);

  await assertPasswordAcceptable(password, email, requestId);

  const base = appBaseUrl(request);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: base ? { emailRedirectTo: `${base}/auth/callback` } : {},
  });

  if (error) {
    logger.warn("signup_rejected", { requestId, code: error.code ?? "unknown" });
    throw badRequest("We could not create the account. Check your details and try again.");
  }
  if (data.session) {
    // Email confirmation is switched off in Supabase. Do not leave an unverified session
    // open; getVerifiedUser() would block AI use anyway, but this is a misconfiguration.
    logger.error("signup_returned_session_confirmations_disabled", { requestId });
    await supabase.auth.signOut();
  }

  // Same response whether or not the address already has an account, so signup cannot be
  // used to find out who is registered.
  return Response.json({ status: "check_email" }, { status: 202 });
});
