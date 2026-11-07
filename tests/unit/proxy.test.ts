import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

const updateSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/supabase-proxy", () => ({ updateSession }));

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://app.example${path}`, { headers });

const signedIn = (signed: boolean) =>
  updateSession.mockImplementation(async (_req: NextRequest, requestHeaders: Headers) => ({
    response: NextResponse.next({ request: { headers: requestHeaders } }),
    user: signed ? { id: "user-1" } : null,
  }));

beforeEach(() => {
  updateSession.mockReset();
});

describe("proxy", () => {
  it("redirects anonymous visitors from protected pages to login and keeps the destination", async () => {
    signedIn(false);
    const response = await proxy(request("/project/abc?tab=files"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/project/abc?tab=files");
  });

  it("protects /dashboard and every /project path, but not lookalike prefixes", async () => {
    signedIn(false);
    expect((await proxy(request("/dashboard"))).status).toBe(307);
    expect((await proxy(request("/project/1/deep/path"))).status).toBe(307);
    expect((await proxy(request("/dashboard-fake"))).status).toBe(200);
    expect((await proxy(request("/projects-info"))).status).toBe(200);
  });

  it("sends signed-in users away from login and signup", async () => {
    signedIn(true);
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      const response = await proxy(request(path));
      expect(new URL(response.headers.get("location") ?? "").pathname, path).toBe("/dashboard");
    }
  });

  it("lets signed-in users reach protected pages", async () => {
    signedIn(true);
    expect((await proxy(request("/dashboard"))).status).toBe(200);
  });

  it("sets a CSP with a fresh nonce on every page response, including redirects", async () => {
    signedIn(false);
    const nonces = new Set<string>();
    for (const path of ["/", "/dashboard", "/login", "/privacy", "/"]) {
      const response = await proxy(request(path));
      const csp = response.headers.get("content-security-policy") ?? "";
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce, path).toBeTruthy();
      nonces.add(nonce ?? "");
      expect(csp).toContain("frame-ancestors 'none'");
    }
    expect(nonces.size).toBe(5);
  });

  it("hands the nonce to the page through the request headers", async () => {
    signedIn(false);
    const response = await proxy(request("/"));
    const forwarded = response.headers.get("x-middleware-request-x-nonce");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(forwarded).toBeTruthy();
    expect(csp).toContain(`'nonce-${forwarded}'`);
  });

  it("applies the security headers and a request id to every response", async () => {
    signedIn(false);
    for (const path of ["/", "/api/health", "/dashboard"]) {
      const response = await proxy(request(path));
      expect(response.headers.get("strict-transport-security"), path).toContain("max-age=");
      expect(response.headers.get("x-content-type-options"), path).toBe("nosniff");
      expect(response.headers.get("referrer-policy"), path).toBeTruthy();
      expect(response.headers.get("permissions-policy"), path).toBeTruthy();
      expect(response.headers.get("x-request-id"), path).toBeTruthy();
    }
  });

  it("does not touch the session for API routes or public pages", async () => {
    signedIn(false);
    await proxy(request("/api/health"));
    await proxy(request("/"));
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("does not put a page CSP on API responses", async () => {
    const response = await proxy(request("/api/auth/login"));
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("replaces a hostile incoming request id", async () => {
    signedIn(false);
    const response = await proxy(request("/", { "x-request-id": "bad id with spaces" }));
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
