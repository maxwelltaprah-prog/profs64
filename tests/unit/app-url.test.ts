import { afterEach, describe, expect, it, vi } from "vitest";

import { appBaseUrl } from "@/lib/security/app-url";

const request = new Request("https://attacker.example/auth/oauth/google", {
  headers: { host: "attacker.example" },
});

afterEach(() => vi.unstubAllEnvs());

describe("appBaseUrl", () => {
  it("prefers APP_URL, without a trailing slash", () => {
    vi.stubEnv("APP_URL", "https://profs64.vercel.app/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "other.vercel.app");
    expect(appBaseUrl(request)).toBe("https://profs64.vercel.app");
  });

  it("falls back to Vercel's production domain, never the request's host, in production", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "profs64.vercel.app");
    expect(appBaseUrl(request)).toBe("https://profs64.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "evil.example/path?x");
    expect(appBaseUrl(request)).toBeUndefined();
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(appBaseUrl(request)).toBeUndefined();
  });

  it("uses the request origin only outside production", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(appBaseUrl(request)).toBe("https://attacker.example");
  });
});
