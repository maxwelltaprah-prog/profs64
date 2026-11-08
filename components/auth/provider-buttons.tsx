"use client";

import { LastUsed } from "@/components/auth/last-used";
import { PROVIDER_LABEL, type OAuthProvider } from "@/lib/security/oauth-providers";
import { saveLastAuth } from "@/lib/workspace/last-auth";

// Plain links: the browser follows the redirect itself; the click only notes the method. Text only: no
// third-party logos are bundled.
export function ProviderButtons({
  providers,
  next,
}: {
  providers: readonly OAuthProvider[];
  next: string;
}) {
  if (providers.length === 0) return null;
  return (
    <>
      <ul className="flex flex-col gap-2.5" aria-label="Continue with">
        {providers.map((provider) => (
          <li key={provider} className="relative">
            <a
              href={`/auth/oauth/${provider}?next=${encodeURIComponent(next)}`}
              data-provider={provider}
              onClick={() => saveLastAuth(provider)}
              className="press border-hairline-strong bg-surface text-text hover:bg-surface-2 flex h-11 w-full items-center justify-center rounded-lg border px-5 text-sm font-medium"
            >
              Continue with {PROVIDER_LABEL[provider]}
            </a>
            <LastUsed method={provider} />
          </li>
        ))}
      </ul>
      <div className="text-subtle flex items-center gap-3 text-xs" role="separator">
        <span className="bg-hairline h-px flex-1" />
        <span>OR</span>
        <span className="bg-hairline h-px flex-1" />
      </div>
    </>
  );
}
