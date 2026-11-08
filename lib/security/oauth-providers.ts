// Sign-in providers the app knows how to start. A provider is offered only when it is listed in
// OAUTH_PROVIDERS (comma separated) AND enabled in the Supabase project, so an unconfigured
// provider never shows a button that cannot work.
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
