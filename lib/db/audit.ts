import "server-only";

import { logger } from "@/lib/security/logger";

import { recordAuditEvent } from "./service";

// Audit writes must be loud when they fail but must not turn an audit outage into a login
// outage, so route handlers use this instead of repeating the try/catch.
export async function auditBestEffort(
  input: Parameters<typeof recordAuditEvent>[0],
): Promise<void> {
  try {
    await recordAuditEvent(input);
  } catch (error) {
    logger.error("audit_write_failed", { requestId: input.requestId, event: input.event, error });
  }
}
