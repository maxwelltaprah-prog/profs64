import "server-only";

import { type OAuthProvider, providersFromSettings } from "@/lib/security/oauth-providers";

import { getPublicEnv } from "./env";

// Which external sign-in providers are switched on in Supabase, asked from its public settings
// endpoint and kept for five minutes. A failed or slow lookup shows no provider buttons rather than
// buttons that might not work; the last good answer is reused if there is one.
const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; providers: OAuthProvider[] } | null = null;

export async function liveProviders(now = Date.now()): Promise<OAuthProvider[]> {
  if (cached && now - cached.at < TTL_MS) return cached.providers;
  try {
    const env = getPublicEnv();
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok) return cached?.providers ?? [];
    const providers = providersFromSettings(await response.json(), process.env["OAUTH_PROVIDERS"]);
    cached = { at: now, providers };
    return providers;
  } catch {
    return cached?.providers ?? [];
  }
}

export function resetProviderCache() {
  cached = null;
}
