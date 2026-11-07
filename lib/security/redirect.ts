// Only same-site relative paths are allowed as post-login destinations; anything else
// (absolute URLs, protocol-relative //host, backslash tricks, control characters) falls back.
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  for (const char of next) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || char === "\\") return fallback;
  }
  return next;
}
