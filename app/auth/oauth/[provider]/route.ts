import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { appBaseUrl } from "@/lib/security/app-url";
import { getClientIp, hashForKey } from "@/lib/security/client-ip";
import { logger } from "@/lib/security/logger";
import { enabledProviders, isKnownProvider } from "@/lib/security/oauth-providers";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { safeRedirectPath } from "@/lib/security/redirect";

// Starts a sign-in with an external provider. The provider comes from a fixed allowlist that must
// also be switched on in OAUTH_PROVIDERS; the return path is checked; the code that comes back is
// exchanged by /auth/callback, the same place email links land.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, request.url));

  if (
    !isKnownProvider(provider) ||
    !enabledProviders(process.env["OAUTH_PROVIDERS"]).includes(provider)
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    await enforceLimits([
      { config: LIMITS.loginIp, key: hashForKey(getClientIp(request.headers)) },
    ]);
  } catch {
    return back("too_many_attempts");
  }

  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  // Without a configured APP_URL in production no return address is sent and Supabase uses its
  // Site URL, rather than trusting a Host header.
  const base = appBaseUrl(request);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      ...(base ? { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}` } : {}),
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    logger.warn("oauth_start_failed", { provider, code: error?.code ?? "no_url" });
    return back("provider_unavailable");
  }
  return NextResponse.redirect(data.url);
}
