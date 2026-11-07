import { weakPassword } from "./errors";
import { logger } from "./logger";
import { checkBreachedPassword, checkPasswordPolicy, passwordProblemMessage } from "./password";

// Throws a 422 with an actionable message unless the password passes the policy and is not
// known to be breached. An unreachable breach service does not block the request.
export async function assertPasswordAcceptable(
  password: string,
  email: string,
  requestId: string,
): Promise<void> {
  const problem = checkPasswordPolicy(password, email);
  if (problem) throw weakPassword(passwordProblemMessage(problem));

  const breach = await checkBreachedPassword(password);
  if (breach === "breached") throw weakPassword(passwordProblemMessage("breached"));
  if (breach === "unknown") logger.warn("breach_check_unavailable", { requestId });
}
