export interface CspOptions {
  nonce: string;
  isDev: boolean;
  // Only send upgrade-insecure-requests when the page itself is served over HTTPS;
  // otherwise a production build served over plain http (local e2e) cannot load its assets.
  isHttps: boolean;
}

export function buildCsp({ nonce, isDev, isHttps }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce-approved scripts load their chunks; React needs eval only in dev.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Dev style injection (HMR) is not nonce-aware, so dev allows inline styles. Production does not.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function securityHeaders(csp: string | null): Record<string, string> {
  return {
    ...(csp ? { "Content-Security-Policy": csp } : {}),
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

// The live preview runs generated code inside an iframe that is sandboxed without
// allow-same-origin, so it has an opaque origin: no cookies, no storage, no access to the app.
// Its own policy is therefore loose where the app's is strict (inline scripts for the import
// map, modules from the CDN, runtime Tailwind) and strict where it matters: it can only talk
// to the CDN, and only the app itself may frame it.
export const PREVIEW_CDN = "https://esm.sh";
export const PREVIEW_TAILWIND = "https://cdn.tailwindcss.com";

export function buildPreviewFrameCsp(): string {
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' blob: ${PREVIEW_CDN} ${PREVIEW_TAILWIND}`,
    `style-src 'unsafe-inline' ${PREVIEW_CDN}`,
    `connect-src ${PREVIEW_CDN}`,
    "img-src https: data: blob:",
    "font-src https: data:",
    "media-src https: data: blob:",
    "worker-src blob:",
    "frame-ancestors 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

export function previewFrameHeaders(): Record<string, string> {
  return {
    ...securityHeaders(buildPreviewFrameCsp()),
    "X-Frame-Options": "SAMEORIGIN",
    "X-Robots-Tag": "noindex",
    "Cache-Control": "no-store",
  };
}
