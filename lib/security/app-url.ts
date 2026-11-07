// Base URL used in auth emails. A Host header is attacker-influenced, so production uses the
// configured APP_URL; request-derived origins are only a development convenience.
export function appBaseUrl(request: Request): string | undefined {
  const configured = process.env["APP_URL"];
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return undefined;
  return new URL(request.url).origin;
}
