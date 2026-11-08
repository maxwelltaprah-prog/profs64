import { after } from "next/server";

import { auditBestEffort } from "@/lib/db/audit";
import { getOptionalUser } from "@/lib/db/auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";

export const POST = withApi("auth.logout", async (_request, { requestId }) => {
  const user = await getOptionalUser();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // The audit row is written after the response is sent, so signing out does not wait for it.
  if (user) after(() => auditBestEffort({ userId: user.id, event: "logout", requestId }));
  return Response.json({ status: "ok" });
});
