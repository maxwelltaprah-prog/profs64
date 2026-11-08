// Base URL used in auth emails and provider sign-in. A Host header is attacker-influenced, so
// production uses the configured APP_URL, or else the production domain Vercel itself sets
// (VERCEL_PROJECT_PRODUCTION_URL); request-derived origins are only a development convenience.
export function appBaseUrl(request: Request): string | undefined {
  const configured = process.env["APP_URL"];
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  if (vercel && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
  if (process.env.NODE_ENV === "production") return undefined;
  return new URL(request.url).origin;
}
