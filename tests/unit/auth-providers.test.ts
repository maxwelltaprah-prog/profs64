import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { liveProviders, resetProviderCache } from "@/lib/db/auth-providers";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  resetProviderCache();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-anon-key-anon-key");
  vi.stubEnv("OAUTH_PROVIDERS", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("liveProviders", () => {
  it("asks Supabase's public settings with the anon key and caches the answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ external: { google: true, github: true, apple: false } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await liveProviders(1_000)).toEqual(["google", "github"]);
    expect(await liveProviders(2_000)).toEqual(["google", "github"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.example/auth/v1/settings");
    expect((init.headers as Record<string, string>)["apikey"]).toBe("anon-key-anon-key-anon-key");
    // After five minutes it asks again.
    await liveProviders(1_000 + 5 * 60 * 1000 + 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows no buttons when Supabase cannot be reached, and keeps a previous good answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await liveProviders(1)).toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ external: { apple: true } })));
    expect(await liveProviders(10)).toEqual(["apple"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    expect(await liveProviders(10 + 6 * 60 * 1000)).toEqual(["apple"]);
  });
});
