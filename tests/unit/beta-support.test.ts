import { beforeEach, describe, expect, it, vi } from "vitest";

import { sentryConnectOrigin, scrubEvent } from "@/lib/monitoring/sentry-options";
import { buildCsp } from "@/lib/security/csp";

import type { ErrorEvent } from "@sentry/nextjs";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const insertFeedback = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/service", () => ({ insertFeedback }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const post = async (body: unknown, origin = "https://app.example") => {
  const { POST } = (await import("@/app/api/feedback/route")) as {
    POST: (request: Request) => Promise<Response>;
  };
  return POST(
    new Request("https://app.example/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", origin, host: "app.example" },
      body: JSON.stringify(body),
    }),
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [getVerifiedUser, insertFeedback, enforceLimits]) fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  enforceLimits.mockResolvedValue(undefined);
  insertFeedback.mockResolvedValue(undefined);
});

describe("POST /api/feedback", () => {
  it("stores the message and page for the signed-in person", async () => {
    expect((await post({ message: "  Nice  ", page: "/library" })).status).toBe(201);
    expect(insertFeedback).toHaveBeenCalledWith({
      userId: "user-1",
      message: "Nice",
      page: "/library",
    });
  });

  it("rejects empty, oversized, unknown-field, odd-page and cross-origin requests", async () => {
    expect((await post({ message: "   " })).status).toBe(422);
    expect((await post({ message: "x".repeat(2001) })).status).toBeGreaterThanOrEqual(400);
    expect((await post({ message: "hi", extra: 1 })).status).toBe(422);
    expect((await post({ message: "hi", page: "https://evil.example" })).status).toBe(422);
    expect((await post({ message: "hi" }, "https://evil.example")).status).toBe(403);
    expect(insertFeedback).not.toHaveBeenCalled();
  });

  it("needs a signed-in person", async () => {
    const errors = await import("@/lib/security/errors");
    getVerifiedUser.mockRejectedValue(errors.unauthenticated());
    expect((await post({ message: "hi" })).status).toBe(401);
  });
});

describe("error reporting privacy", () => {
  it("removes cookies, bodies, users, breadcrumbs and extras and shortens messages", () => {
    const event = {
      type: undefined,
      message: "m".repeat(500),
      user: { email: "a@b.test" },
      breadcrumbs: [{ message: "fetch /api/chat" }],
      extra: { prompt: "secret prompt" },
      request: {
        url: "https://app.example/api/x?token=abc",
        method: "POST",
        data: "secret body",
        cookies: { sb: "x" },
        headers: { authorization: "Bearer x" },
      },
      exception: { values: [{ type: "Error", value: "v".repeat(500) }] },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toEqual({ url: "https://app.example/api/x", method: "POST" });
    expect(out.message?.length).toBe(200);
    expect(out.exception?.values?.[0]?.value?.length).toBe(200);
  });

  it("allows only the ingest origin in the CSP, and only when configured", () => {
    const origin = sentryConnectOrigin("https://key@o1.ingest.sentry.io/42");
    expect(origin).toBe("https://o1.ingest.sentry.io");
    expect(sentryConnectOrigin(undefined)).toBeNull();
    expect(sentryConnectOrigin("http://insecure.example/1")).toBeNull();
    expect(sentryConnectOrigin("not a url")).toBeNull();
    const withReport = buildCsp({ nonce: "n", isDev: false, isHttps: true, reportOrigin: origin });
    expect(withReport).toContain("connect-src 'self' https://o1.ingest.sentry.io;");
    expect(buildCsp({ nonce: "n", isDev: false, isHttps: true })).toContain("connect-src 'self';");
  });
});
