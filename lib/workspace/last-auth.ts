// Remembers, in this browser only, which sign-in method was used last so the sign-in page can
// point to it. It holds a method name, never an email address or anything secret.
const KEY = "buildr:last-auth";
const METHODS = new Set(["email", "google", "github", "apple"]);

export function readLastAuth(): string | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value && METHODS.has(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLastAuth(method: string): void {
  if (!METHODS.has(method)) return;
  try {
    window.localStorage.setItem(KEY, method);
  } catch {
    // Storage can be unavailable; the hint is optional.
  }
}
