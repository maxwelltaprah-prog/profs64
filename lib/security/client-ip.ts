import { createHash } from "node:crypto";

// Behind Vercel or another trusted proxy, the platform sets these headers. If the app is ever
// exposed directly to the internet, they are attacker-controlled and rate limits keyed on the
// IP become bypassable; see docs/SECURITY.md.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = headers.get("x-real-ip")?.trim() || forwarded || "";
  return candidate.length > 0 && candidate.length <= 64 ? candidate : "unknown";
}

// Limiter keys and logs use a hash so raw IPs and emails are not stored in Redis or logs.
export function hashForKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
