import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enabledProviders,
  isKnownProvider,
  providersFromSettings,
} from "@/lib/security/oauth-providers";

describe("providers from Supabase settings", () => {
  it("offers exactly the providers Supabase has switched on", () => {
    const settings = { external: { google: true, github: false, apple: true, email: true } };
    expect(providersFromSettings(settings, undefined)).toEqual(["google", "apple"]);
    expect(providersFromSettings({ external: { google: false } }, undefined)).toEqual([]);
  });
  it("lets OAUTH_PROVIDERS narrow the list but never add to it", () => {
    const settings = { external: { google: true, github: true } };
    expect(providersFromSettings(settings, "github")).toEqual(["github"]);
    expect(providersFromSettings(settings, "apple")).toEqual([]);
    expect(providersFromSettings(settings, "  ")).toEqual(["google", "github"]);
  });
  it("treats anything unexpected as off", () => {
    for (const bad of [null, "x", {}, { external: null }, { external: { google: "yes" } }])
      expect(providersFromSettings(bad, undefined)).toEqual([]);
  });
});

describe("provider allowlist", () => {
  it("offers only known providers that are switched on, in a fixed order", () => {
    expect(enabledProviders(undefined)).toEqual([]);
    expect(enabledProviders("")).toEqual([]);
    expect(enabledProviders(" Apple , google ,facebook,../x")).toEqual(["google", "apple"]);
  });
  it("recognises only the allowlisted names", () => {
    expect(isKnownProvider("github")).toBe(true);
    for (const bad of ["GitHub", "gitlab", "", "google/../x", "__proto__"])
      expect(isKnownProvider(bad), bad).toBe(false);
  });
});

const signInWithOAuth = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
const liveProviders = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/auth-providers", () => ({ liveProviders }));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithOAuth } }),
}));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const start = async (provider: string, query = "") => {
  const { GET } = await import("@/app/auth/oauth/[provider]/route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest(`https://app.example/auth/oauth/${provider}${query}`), {
    params: Promise.resolve({ provider }),
  });
};

describe("GET /auth/oauth/[provider]", () => {
  beforeEach(() => {
    vi.resetModules();
    signInWithOAuth.mockReset();
    enforceLimits.mockReset().mockResolvedValue(undefined);
    liveProviders.mockReset().mockResolvedValue(["google", "github"]);
    vi.stubEnv("APP_URL", "https://app.example");
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.example/auth" },
      error: null,
    });
  });

  it("sends the person to the provider, returning through the shared callback", async () => {
    const response = await start("google", "?next=/project/abc");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://accounts.example/auth");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://app.example/auth/callback?next=%2Fproject%2Fabc",
        skipBrowserRedirect: true,
      },
    });
  });

  it("turns an off-site return path into the default", async () => {
    await start("google", "?next=https://evil.example/x");
    expect(signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
      "https://app.example/auth/callback?next=%2Fdashboard",
    );
  });

  it("is a 404 for providers that are unknown or not switched on, without calling Supabase", async () => {
    for (const provider of ["apple", "gitlab", "..%2Fx"]) {
      expect((await start(provider)).status, provider).toBe(404);
    }
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("returns to the login page with a plain notice when the provider fails or limits are hit", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { code: "x" } });
    expect((await start("github")).headers.get("location")).toContain(
      "/login?error=provider_unavailable",
    );
    enforceLimits.mockRejectedValue(new Error("limited"));
    expect((await start("github")).headers.get("location")).toContain(
      "/login?error=too_many_attempts",
    );
  });
});
