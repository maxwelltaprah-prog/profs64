import { auditBestEffort } from "@/lib/db/audit";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { getClientIp, hashForKey } from "@/lib/security/client-ip";
import { invalidCredentials } from "@/lib/security/errors";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { AUTH_BODY_LIMIT_BYTES, loginSchema } from "@/lib/security/schemas";

export const POST = withApi("auth.login", async (request, { requestId }) => {
  await enforceLimits([{ config: LIMITS.loginIp, key: hashForKey(getClientIp(request.headers)) }]);
  const { email, password } = await readJson(request, loginSchema, AUTH_BODY_LIMIT_BYTES);
  await enforceLimits([{ config: LIMITS.loginAccount, key: hashForKey(email) }]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // One message for wrong password, unknown account and unconfirmed email.
  if (error || !data.user) throw invalidCredentials();

  await auditBestEffort({ userId: data.user.id, event: "login", requestId });

  return Response.json({ status: "ok", emailVerified: Boolean(data.user.email_confirmed_at) });
});
