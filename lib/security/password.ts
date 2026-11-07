import { createHash } from "node:crypto";

import { PASSWORD_MAX, PASSWORD_MIN } from "./schemas";

export type PasswordProblem =
  "too_short" | "too_long" | "contains_email" | "too_common" | "breached";

// A small deny-list for the worst offenders; the breach check below does the heavy lifting.
const COMMON = new Set([
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "letmein12345",
  "iloveyou1234",
  "administrator",
  "welcome12345",
]);

export function checkPasswordPolicy(password: string, email: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return "too_short";
  if (password.length > PASSWORD_MAX) return "too_long";
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local)) return "contains_email";
  if (COMMON.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) return "too_common";
  return null;
}

export type BreachResult = "breached" | "clean" | "unknown";

// Have I Been Pwned range API (k-anonymity): only the first 5 hex characters of the SHA-1
// hash leave the server, never the password. Padding hides the real response size.
export async function checkBreachedPassword(
  password: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2000,
): Promise<BreachResult> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) return "unknown";
    const body = await response.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix && Number(count) > 0) return "breached";
    }
    return "clean";
  } catch {
    return "unknown";
  }
}

export function passwordProblemMessage(problem: PasswordProblem): string {
  switch (problem) {
    case "too_short":
      return `Use at least ${PASSWORD_MIN} characters.`;
    case "too_long":
      return `Use at most ${PASSWORD_MAX} characters.`;
    case "contains_email":
      return "Remove your email address from the password.";
    case "too_common":
      return "That password is too easy to guess. Choose a different one.";
    case "breached":
      return "That password has appeared in a known data breach. Choose a different one.";
  }
}
