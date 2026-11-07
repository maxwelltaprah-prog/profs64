import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { getClientIp, hashForKey } from "@/lib/security/client-ip";
import { checkBreachedPassword, checkPasswordPolicy } from "@/lib/security/password";
import { createMemoryLimiter } from "@/lib/security/rate-limit";

describe("password policy", () => {
  it("accepts a long passphrase", () => {
    expect(checkPasswordPolicy("correct horse battery staple", "person@example.com")).toBeNull();
  });

  it.each([
    ["short", "too_short"],
    ["x".repeat(129), "too_long"],
    ["person-is-here-123", "contains_email"],
    ["PASSWORD1234", "too_common"],
    ["aaaaaaaaaaaaaa", "too_common"],
  ])("rejects %j as %s", (password, problem) => {
    expect(checkPasswordPolicy(password, "person@example.com")).toBe(problem);
  });

  it("ignores very short email local parts rather than rejecting innocent passwords", () => {
    expect(checkPasswordPolicy("abc-is-fine-in-here-1", "abc@example.com")).toBeNull();
  });
});

describe("breached password check", () => {
  const sha1 = (value: string) => createHash("sha1").update(value).digest("hex").toUpperCase();
  const reply = (body: string, ok = true) =>
    vi.fn(async () => new Response(body, { status: ok ? 200 : 503 }));

  it("flags a password whose hash suffix appears in the range response", async () => {
    const hash = sha1("hunter2-hunter2");
    const fetchMock = reply(`0000000000000000000000000000000000A:0\r\n${hash.slice(5)}:1234\r\n`);
    expect(await checkBreachedPassword("hunter2-hunter2", fetchMock)).toBe("breached");
  });

  it("treats padding entries (count 0) as not breached", async () => {
    const hash = sha1("padded-password-1");
    expect(await checkBreachedPassword("padded-password-1", reply(`${hash.slice(5)}:0\r\n`))).toBe(
      "clean",
    );
  });

  it("sends only a 5-character hash prefix, never the password or full hash", async () => {
    const fetchMock = reply("");
    await checkBreachedPassword("a very private password", fetchMock);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const [url, init] = calls[0] ?? ["", {}];
    expect(url).toBe(
      `https://api.pwnedpasswords.com/range/${sha1("a very private password").slice(0, 5)}`,
    );
    expect(url).not.toContain("private");
    expect(new Headers(init.headers).get("Add-Padding")).toBe("true");
  });

  it("reports unknown, not clean, when the service fails", async () => {
    expect(await checkBreachedPassword("whatever-password", reply("", false))).toBe("unknown");
    expect(
      await checkBreachedPassword(
        "whatever-password",
        vi.fn(async () => {
          throw new Error("offline");
        }),
      ),
    ).toBe("unknown");
  });
});

describe("memory rate limiter", () => {
  const config = { name: "t", limit: 3, windowSeconds: 60 };

  it("allows up to the limit, then blocks with a retry time", async () => {
    let now = 1_000_000;
    const limiter = createMemoryLimiter(config, () => now);
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await limiter.limit("k"));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
    expect(results[2]?.remaining).toBe(0);
    expect(results[3]?.retryAfterSeconds).toBe(60);
    now += 30_000;
    expect((await limiter.limit("k")).retryAfterSeconds).toBe(30);
  });

  it("opens a fresh window after it expires", async () => {
    let now = 0;
    const limiter = createMemoryLimiter(config, () => now);
    for (let i = 0; i < 4; i++) await limiter.limit("k");
    now += 60_001;
    expect((await limiter.limit("k")).allowed).toBe(true);
  });

  it("keeps keys independent", async () => {
    const limiter = createMemoryLimiter(config, () => 0);
    for (let i = 0; i < 4; i++) await limiter.limit("a");
    expect((await limiter.limit("a")).allowed).toBe(false);
    expect((await limiter.limit("b")).allowed).toBe(true);
  });

  it("stays bounded when flooded with distinct keys", async () => {
    const limiter = createMemoryLimiter(config, () => 0);
    for (let i = 0; i < 12_000; i++) await limiter.limit(`flood-${i}`);
    expect((await limiter.limit("after-flood")).allowed).toBe(true);
  });
});

describe("client ip and key hashing", () => {
  it("prefers x-real-ip, then the first forwarded address, else unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe(
      "1.1.1.1",
    );
    expect(getClientIp(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(getClientIp(new Headers())).toBe("unknown");
    expect(getClientIp(new Headers({ "x-forwarded-for": "x".repeat(200) }))).toBe("unknown");
  });

  it("hashes keys so raw addresses and emails are not stored", () => {
    const key = hashForKey("person@example.com");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain("person");
    expect(hashForKey("person@example.com")).toBe(key);
  });
});
