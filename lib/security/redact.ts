// Keys whose values must never reach a log line, matched case-insensitively as substrings.
const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "api-key",
  "prompt",
  "content",
  "messages",
  "parts",
  "email",
  "jwt",
  "session",
];

const JWT_LIKE = /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g;
const BEARER = /\bBearer\s+[\w.~+/=-]{8,}/gi;
const PROVIDER_KEY = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g;

export const REDACTED = "[redacted]";

const isSensitiveKey = (key: string) => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((needle) => lower.includes(needle));
};

export function redactString(value: string): string {
  return value
    .replace(JWT_LIKE, REDACTED)
    .replace(BEARER, REDACTED)
    .replace(PROVIDER_KEY, REDACTED);
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        isSensitiveKey(key) ? REDACTED : redact(inner, depth + 1),
      ]),
    );
  }
  return value;
}
