// Extension point for TOTP MFA. Supabase reports an Authenticator Assurance Level (aal1 =
// password only, aal2 = password plus a second factor). Raise REQUIRED_AAL to "aal2" and call
// assuranceSatisfied() from getVerifiedUser() when MFA enrollment ships; nothing else changes.
export type AuthenticatorAssuranceLevel = "aal1" | "aal2";

export const REQUIRED_AAL: AuthenticatorAssuranceLevel = "aal1";

export function assuranceSatisfied(
  current: AuthenticatorAssuranceLevel | null | undefined,
  required: AuthenticatorAssuranceLevel = REQUIRED_AAL,
): boolean {
  if (current !== "aal1" && current !== "aal2") return false;
  return required === "aal1" ? true : current === "aal2";
}
