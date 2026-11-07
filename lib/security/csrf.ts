import { forbidden } from "./errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Browsers always send Origin on cross-site POSTs. Requests with neither a matching Origin
// nor a same-origin Sec-Fetch-Site are refused, so a form on another site cannot act as the
// signed-in user. Non-browser clients must send a matching Origin or none of these headers
// are needed because they carry no ambient cookies.
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (origin !== null) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw forbidden();
    }
    if (host !== null && originHost === host) return;
    throw forbidden();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return;
  throw forbidden();
}
