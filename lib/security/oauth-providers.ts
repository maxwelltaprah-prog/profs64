// Sign-in providers the app knows how to start. A provider is offered only when it is switched on
// in the Supabase project (read from its public auth settings), so an unconfigured provider never
// shows a button that cannot work. OAUTH_PROVIDERS, when set, narrows that list further.
export const KNOWN_PROVIDERS = ["google", "github", "apple"] as const;
export type OAuthProvider = (typeof KNOWN_PROVIDERS)[number];

export const PROVIDER_LABEL: Readonly<Record<OAuthProvider, string>> = {
  google: "Google",
  github: "GitHub",
  apple: "Apple",
};

export function isKnownProvider(value: string): value is OAuthProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(value);
}

export function enabledProviders(raw: string | undefined): OAuthProvider[] {
  const wanted = new Set((raw ?? "").split(",").map((item) => item.trim().toLowerCase()));
  return KNOWN_PROVIDERS.filter((provider) => wanted.has(provider));
}

// Supabase's public /auth/v1/settings response has `external: { google: true, ... }`. Anything
// unexpected counts as "off".
export function providersFromSettings(
  settings: unknown,
  override: string | undefined,
): OAuthProvider[] {
  const external =
    settings && typeof settings === "object" && "external" in settings
      ? (settings as { external: unknown }).external
      : null;
  if (!external || typeof external !== "object") return [];
  // Read only the fixed provider names, through a Map, never by an arbitrary key.
  const flags = new Map(Object.entries(external as Record<string, unknown>));
  const on = KNOWN_PROVIDERS.filter((provider) => flags.get(provider) === true);
  const narrowed = (override ?? "").trim() ? enabledProviders(override) : null;
  return narrowed ? on.filter((provider) => narrowed.includes(provider)) : on;
}
