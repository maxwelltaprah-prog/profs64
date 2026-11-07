import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:3100";
const sameOrigin = { origin: ORIGIN, "content-type": "application/json" };

// Playwright JSON-encodes string bodies when the content type is JSON, which would turn
// "{broken" into a valid JSON string. A Buffer is sent exactly as given.
const raw = (body: string) => Buffer.from(body);

// Every case below must be rejected before Supabase is contacted, so these run without a backend.
test.describe("auth API abuse", () => {
  test("cross-origin and header-less state-changing requests are refused", async ({ request }) => {
    const body = JSON.stringify({ email: "a@example.com", password: "x" });
    const evil = await request.post("/api/auth/login", {
      data: raw(body),
      headers: { origin: "https://evil.example", "content-type": "application/json" },
    });
    expect(evil.status()).toBe(403);
    const bare = await request.post("/api/auth/login", {
      data: raw(body),
      headers: { "content-type": "application/json" },
    });
    expect(bare.status()).toBe(403);
    expect((await evil.json()).error.code).toBe("forbidden");
  });

  test("wrong content type, oversized, malformed and unknown-field bodies", async ({ request }) => {
    const post = (data: string, headers: Record<string, string> = {}) =>
      request.post("/api/auth/login", { data: raw(data), headers: { ...sameOrigin, ...headers } });

    expect(
      (await post("a=b", { "content-type": "application/x-www-form-urlencoded" })).status(),
    ).toBe(415);
    expect(
      (
        await post(JSON.stringify({ email: "a@example.com", password: "x".repeat(10_000) }))
      ).status(),
    ).toBe(413);
    expect((await post("{broken")).status()).toBe(400);
    expect(
      (await post(JSON.stringify({ email: "a@example.com", password: "x", admin: true }))).status(),
    ).toBe(422);
    expect((await post(JSON.stringify({ email: "not-an-email", password: "x" }))).status()).toBe(
      422,
    );
  });

  test("errors are JSON with a request id and no stack or internals", async ({ request }) => {
    const response = await request.post("/api/auth/signup", {
      data: raw("{broken"),
      headers: sameOrigin,
    });
    const body = await response.json();
    expect(body.error.requestId).toBe(response.headers()["x-request-id"]);
    expect(JSON.stringify(body)).not.toMatch(/at \w+|node_modules|\/home\//);
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("a caller-supplied request id is reused only when it is a plain token", async ({
    request,
  }) => {
    const good = "e2e-trace-12345678";
    const ok = await request.post("/api/auth/signup", {
      data: raw("{"),
      headers: { ...sameOrigin, "x-request-id": good },
    });
    expect(ok.headers()["x-request-id"]).toBe(good);
    const bad = await request.post("/api/auth/signup", {
      data: raw("{"),
      headers: { ...sameOrigin, "x-request-id": "<script>alert(1)</script>" },
    });
    expect(bad.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("password reset requests are rate limited per source address", async ({ request }) => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 8)}`.slice(
      0,
      40,
    );
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const response = await request.post("/api/auth/forgot-password", {
        // Malformed on purpose so the limiter is exercised without sending any email.
        data: raw(JSON.stringify({ email: "not-an-email" })),
        headers: { ...sameOrigin, "x-real-ip": ip },
      });
      statuses.push(response.status());
      if (response.status() === 429)
        expect(Number(response.headers()["retry-after"])).toBeGreaterThan(0);
    }
    expect(statuses).toEqual([422, 422, 422, 422, 422, 429, 429]);
  });

  test("protected pages are never served without a confirmed session", async ({ request }) => {
    const response = await request.get("/dashboard", { maxRedirects: 0 });
    // The proxy redirects signed-out visitors to /login; the page itself must not be served.
    expect(response.status()).not.toBe(200);
    if (response.status() === 307) {
      expect(new URL(response.headers()["location"] ?? "", "http://localhost").pathname).toBe(
        "/login",
      );
    }
  });
});

test.describe("chat API without a session", () => {
  const body = JSON.stringify({
    id: "11111111-1111-4111-8111-111111111111",
    message: { role: "user", parts: [{ type: "text", text: "hello" }] },
  });
  const headers = { "content-type": "application/json", origin: "http://127.0.0.1:3100" };

  test("refuses signed-out requests and never starts a stream", async ({ request }) => {
    const response = await request.post("/api/chat", { headers, data: Buffer.from(body) });
    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["x-vercel-ai-ui-message-stream"]).toBeUndefined();
  });

  test("refuses cross-site requests", async ({ request }) => {
    const response = await request.post("/api/chat", {
      headers: { ...headers, origin: "https://evil.example" },
      data: Buffer.from(body),
    });
    expect(response.status()).toBe(403);
  });

  test("does not answer GET", async ({ request }) => {
    expect((await request.get("/api/chat")).status()).toBe(405);
  });

  test("project APIs need a session too", async ({ request }) => {
    expect((await request.get("/api/projects")).status()).toBe(401);
    expect(
      (await request.get("/api/projects/11111111-1111-4111-8111-111111111111/files")).status(),
    ).toBe(401);
    const created = await request.post("/api/projects", {
      headers,
      data: Buffer.from(JSON.stringify({ name: "x" })),
    });
    expect(created.status()).toBe(401);
  });
});
