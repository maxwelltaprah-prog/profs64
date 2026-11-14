import "server-only";

import {
  enabledProviders,
  type OAuthProvider,
  providersFromSettings,
} from "@/lib/security/oauth-providers";

import { getPublicEnv } from "./env";

// Which external sign-in providers are switched on in Supabase, asked from its public settings
// endpoint and kept for five minutes. Empty answers expire quickly so a newly enabled provider
// appears promptly; on lookup failure, an explicit server allowlist is used as a fallback.
const TTL_MS = 5 * 60 * 1000;
const EMPTY_TTL_MS = 15 * 1000;
let cached: { at: number; providers: OAuthProvider[] } | null = null;

export async function liveProviders(now = Date.now()): Promise<OAuthProvider[]> {
  if (cached && now - cached.at < (cached.providers.length > 0 ? TTL_MS : EMPTY_TTL_MS)) {
    return cached.providers;
  }
  const configured = enabledProviders(process.env["OAUTH_PROVIDERS"]);
  try {
    const env = getPublicEnv();
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok) return cached?.providers.length ? cached.providers : configured;
    const providers = providersFromSettings(await response.json(), process.env["OAUTH_PROVIDERS"]);
    cached = { at: now, providers };
    return providers;
  } catch {
    return cached?.providers.length ? cached.providers : configured;
  }
}

export function resetProviderCache() {
  cached = null;
}
