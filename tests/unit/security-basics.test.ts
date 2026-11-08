import { describe, expect, it, vi } from "vitest";

import { buildCsp, newNonce, securityHeaders } from "@/lib/security/csp";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AppError, errorResponse, rateLimited } from "@/lib/security/errors";
import { logger } from "@/lib/security/logger";
import { assuranceSatisfied } from "@/lib/security/mfa";
import { REDACTED, redact, redactString } from "@/lib/security/redact";
import { safeRedirectPath } from "@/lib/security/redirect";
import { getRequestId } from "@/lib/security/request-id";

describe("request ids", () => {
  it("keeps a plain token and replaces anything that could forge log lines", () => {
    expect(getRequestId(new Headers({ "x-request-id": "abc-12345678" }))).toBe("abc-12345678");
    for (const bad of ["short", "has space 12345678", "x".repeat(65), "<script>12345678"]) {
      const id = getRequestId(new Headers({ "x-request-id": bad }));
      expect(id).not.toBe(bad);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});

describe("error responses", () => {
  it("returns the message of known errors and headers such as Retry-After", async () => {
    const response = errorResponse(rateLimited(42), "req-1");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: {
        code: "rate_limited",
        message: "Too many attempts. Try again in 42 seconds.",
        requestId: "req-1",
      },
    });
  });

  it("hides the details of unexpected errors", async () => {
    const response = errorResponse(
      new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"),
      "req-2",
    );
    const text = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("hunter2");
    expect(text).toContain("req-2");
  });

  it("AppError carries status and code", () => {
    const error = new AppError(418, "teapot", "short and stout");
    expect([error.status, error.code, error.message]).toEqual([418, "teapot", "short and stout"]);
  });
});

describe("redaction and logging", () => {
  it("redacts sensitive keys at any depth, case-insensitively", () => {
    const out = redact({
      ok: "keep",
      Password: "p",
      nested: {
        accessToken: "t",
        prompt: "secret prompt",
        deeper: [{ fileContent: "src", fine: 1 }],
      },
      email: "a@b.co",
    }) as Record<string, unknown>;
    expect(out).toEqual({
      ok: "keep",
      Password: REDACTED,
      nested: {
        accessToken: REDACTED,
        prompt: REDACTED,
        deeper: [{ fileContent: REDACTED, fine: 1 }],
      },
      email: REDACTED,
    });
  });

  it("scrubs token-shaped values inside ordinary strings", () => {
    // Assembled at runtime so the repo contains no token-shaped literal for secret scanners to flag.
    const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "abcdefghijklmnop"].join(
      ".",
    );
    expect(redactString(`failed for ${jwt} now`)).toBe(`failed for ${REDACTED} now`);
    expect(redactString("Authorization: Bearer abcdefghijklmnop12345")).not.toContain(
      "abcdefghijklmnop12345",
    );
    expect(redactString("key sk-or-v1-abcdefghijklmnopqrstuv end")).not.toContain(
      "abcdefghijklmnopqrstuv",
    );
  });

  it("serializes errors without stack traces", () => {
    const out = redact({ error: new Error("boom") }) as { error: Record<string, unknown> };
    expect(out.error).toEqual({ name: "Error", message: "boom" });
  });

  it("writes one JSON line per event and never leaks prompts, content or emails", () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines: string[] = [];
    const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      logger.info("chat_finished", {
        requestId: "r-1",
        prompt: "build me a site for secret-project",
        fileContent: "const apiKey = 'x'",
        email: "person@example.com",
        status: 200,
      });
    } finally {
      out.mockRestore();
      vi.unstubAllEnvs();
    }
    expect(lines).toHaveLength(1);
    const line = lines[0] ?? "";
    expect(line.endsWith("\n")).toBe(true);
    expect(line).not.toMatch(/secret-project|apiKey|person@example/);
    expect(JSON.parse(line)).toMatchObject({
      level: "info",
      event: "chat_finished",
      requestId: "r-1",
      status: 200,
    });
  });
});

describe("log level", () => {
  it("drops events below the configured level, and everything when silent", () => {
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      vi.stubEnv("LOG_LEVEL", "warn");
      logger.info("quiet");
      expect(out).not.toHaveBeenCalled();
      logger.warn("loud");
      expect(err).toHaveBeenCalledTimes(1);
      vi.stubEnv("LOG_LEVEL", "silent");
      logger.error("silenced");
      expect(err).toHaveBeenCalledTimes(1);
    } finally {
      out.mockRestore();
      err.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe("content security policy", () => {
  const prod = buildCsp({ nonce: "NONCE", isDev: false, isHttps: true });

  it("is strict in production", () => {
    expect(prod).toContain("script-src 'self' 'nonce-NONCE' 'strict-dynamic'");
    expect(prod).toContain("style-src 'self' 'nonce-NONCE'");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
    expect(prod).not.toContain("unsafe-inline");
    expect(prod).not.toContain("unsafe-eval");
  });

  it("only loosens for development, and only upgrades requests over HTTPS", () => {
    const dev = buildCsp({ nonce: "N", isDev: true, isHttps: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(buildCsp({ nonce: "N", isDev: false, isHttps: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("generates unpredictable, unique nonces", () => {
    const nonces = new Set(Array.from({ length: 200 }, newNonce));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("sets every required security header", () => {
    const headers = securityHeaders(prod);
    for (const name of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Frame-Options",
    ]) {
      expect(headers[name], name).toBeTruthy();
    }
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(securityHeaders(null)["Content-Security-Policy"]).toBeUndefined();
  });

  it("allows the microphone for this origin only and keeps the other sensors off", () => {
    const policy = securityHeaders(prod)["Permissions-Policy"] ?? "";
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).not.toContain("microphone=*");
  });
});

describe("CSRF origin check", () => {
  const post = (headers: Record<string, string>) =>
    new Request("https://app.example/api/x", { method: "POST", headers });

  it("allows same-origin requests and safe methods", () => {
    expect(() =>
      assertSameOrigin(post({ origin: "https://app.example", host: "app.example" })),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        post({
          origin: "https://app.example",
          "x-forwarded-host": "app.example",
          host: "internal:3000",
        }),
      ),
    ).not.toThrow();
    expect(() => assertSameOrigin(post({ "sec-fetch-site": "same-origin" }))).not.toThrow();
    expect(() =>
      assertSameOrigin(
        new Request("https://app.example/x", {
          method: "GET",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    ["foreign origin", { origin: "https://evil.example", host: "app.example" }],
    [
      "origin that merely contains the host",
      { origin: "https://app.example.evil.example", host: "app.example" },
    ],
    ["null origin", { origin: "null", host: "app.example" }],
    ["malformed origin", { origin: "not a url", host: "app.example" }],
    ["cross-site fetch metadata", { "sec-fetch-site": "cross-site", host: "app.example" }],
    ["no origin and no fetch metadata", { host: "app.example" }],
  ])("blocks %s", (_label, headers) => {
    expect(() => assertSameOrigin(post(headers))).toThrowError(AppError);
  });
});

describe("safe redirect", () => {
  it.each(["/dashboard", "/project/123?tab=files", "/"])("keeps %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/ok\nSet-Cookie: x=1",
    "/a\\b",
    "",
    "dashboard",
    `/${"a".repeat(600)}`,
    null,
    undefined,
  ])("falls back for %j", (value) => {
    expect(safeRedirectPath(value as string | null | undefined)).toBe("/dashboard");
  });
});

describe("MFA extension point", () => {
  it("only aal2 satisfies an aal2 requirement, and unknown levels never satisfy", () => {
    expect(assuranceSatisfied("aal1", "aal1")).toBe(true);
    expect(assuranceSatisfied("aal2", "aal1")).toBe(true);
    expect(assuranceSatisfied("aal1", "aal2")).toBe(false);
    expect(assuranceSatisfied("aal2", "aal2")).toBe(true);
    expect(assuranceSatisfied(null, "aal1")).toBe(false);
    expect(assuranceSatisfied(undefined)).toBe(false);
  });
});
