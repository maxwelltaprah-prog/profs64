import { auditBestEffort } from "@/lib/db/audit";
import { getOptionalUser } from "@/lib/db/auth";
import { exportUserData } from "@/lib/db/service";
import { withApi } from "@/lib/security/api";
import { unauthenticated } from "@/lib/security/errors";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";

// A download of everything stored about the signed-in account. Works before email confirmation,
// because people can always get their own data.
export const GET = withApi("account.export", async (_request, { requestId }) => {
  const user = await getOptionalUser();
  if (!user) throw unauthenticated();
  await enforceLimits([{ config: LIMITS.accountExportUser, key: user.id }]);

  const data = await exportUserData(user.id);
  await auditBestEffort({ userId: user.id, event: "data_exported", requestId });

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="buildr-export.json"',
    },
  });
});
