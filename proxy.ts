import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/db/supabase-proxy";
import { buildCsp, newNonce, securityHeaders } from "@/lib/security/csp";
import { getRequestId } from "@/lib/security/request-id";

// Next.js 16 renamed middleware to proxy. It sets security headers and a per-request CSP
// nonce, refreshes the Supabase session and does optimistic redirects. It is not an
// authorization layer: every page and route re-verifies the user itself.

const PROTECTED_PREFIXES = ["/dashboard", "/project", "/account", "/start"];
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

function applyHeaders(response: NextResponse, csp: string | null, requestId: string) {
  for (const [name, value] of Object.entries(securityHeaders(csp)))
    response.headers.set(name, value);
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = getRequestId(request.headers);
  const isHttps =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  // API routes return JSON, so they get the headers but no nonce and no session refresh;
  // each handler authenticates for itself.
  if (pathname.startsWith("/api/")) {
    const headers = new Headers(request.headers);
    headers.set("x-request-id", requestId);
    return applyHeaders(NextResponse.next({ request: { headers } }), null, requestId);
  }

  const nonce = newNonce();
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development", isHttps });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("Content-Security-Policy", csp);

  const needsUser = matches(pathname, PROTECTED_PREFIXES) || matches(pathname, GUEST_ONLY);
  if (!needsUser) {
    return applyHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      csp,
      requestId,
    );
  }

  const { response, user } = await updateSession(request, requestHeaders);

  if (!user && matches(pathname, PROTECTED_PREFIXES)) {
    const target = new URL("/login", request.url);
    target.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(target);
    // Keep any refreshed-cookie writes (e.g. clearing a dead session) on the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return applyHeaders(redirect, csp, requestId);
  }

  if (user && matches(pathname, GUEST_ONLY)) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return applyHeaders(redirect, csp, requestId);
  }

  return applyHeaders(response, csp, requestId);
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
