import { auditBestEffort } from "@/lib/db/audit";
import { getOptionalUser } from "@/lib/db/auth";
import { deleteAuthUser } from "@/lib/db/service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { invalidCredentials, unauthenticated } from "@/lib/security/errors";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { AUTH_BODY_LIMIT_BYTES, deleteAccountSchema } from "@/lib/security/schemas";

// Permanent. Requires the password again so a hijacked session alone cannot destroy an account.
export const POST = withApi("account.delete", async (request, { requestId }) => {
  const user = await getOptionalUser();
  if (!user?.email) throw unauthenticated();
  await enforceLimits([{ config: LIMITS.accountDeleteUser, key: user.id }]);

  const { password } = await readJson(request, deleteAccountSchema, AUTH_BODY_LIMIT_BYTES);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (error) throw invalidCredentials();

  // Recorded first: the audit row is anonymised (user id removed) when the account goes.
  await auditBestEffort({ userId: user.id, event: "account_deleted", requestId });
  await deleteAuthUser(user.id);
  await supabase.auth.signOut();
  return Response.json({ status: "deleted" });
});
