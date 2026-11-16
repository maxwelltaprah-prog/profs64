import { beforeEach, describe, expect, it, vi } from "vitest";

import { INTEGRATION_CATEGORIES, INTEGRATION_IDS, INTEGRATIONS } from "@/lib/integrations/catalog";
import { coverVariant, COVER_VARIANTS } from "@/lib/workspace/cover";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/service", () => ({ recordAuditEvent }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const headers = {
  "content-type": "application/json",
  origin: "https://app.example",
  host: "app.example",
};
const post = async (body: unknown) => {
  const { POST } = (await import("@/app/api/integrations/waitlist/route")) as {
    POST: (request: Request) => Promise<Response>;
  };
  return POST(
    new Request("https://app.example/api/integrations/waitlist", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [getVerifiedUser, recordAuditEvent, enforceLimits]) fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  enforceLimits.mockResolvedValue(undefined);
  recordAuditEvent.mockResolvedValue(undefined);
});

describe("integration catalog", () => {
  it("has unique ids, known categories and honest statuses", () => {
    expect(new Set(INTEGRATION_IDS).size).toBe(INTEGRATIONS.length);
    for (const integration of INTEGRATIONS) {
      expect(INTEGRATION_CATEGORIES).toContain(integration.category);
      // Nothing is connected yet; flip this test when the first integration ships.
      expect(integration.status).toBe("planned");
    }
  });
});

describe("POST /api/integrations/waitlist", () => {
  it("records the integration id only", async () => {
    expect((await post({ integration: "github" })).status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      event: "integration_interest",
      metadata: { integration: "github" },
      requestId: expect.any(String),
    });
  });

  it("rejects unknown ids, extra fields and bad origins", async () => {
    expect((await post({ integration: "nope" })).status).toBe(422);
    expect((await post({ integration: "github", extra: 1 })).status).toBe(422);
    const { POST } = (await import("@/app/api/integrations/waitlist/route")) as {
      POST: (request: Request) => Promise<Response>;
    };
    const evil = await POST(
      new Request("https://app.example/api/integrations/waitlist", {
        method: "POST",
        headers: { ...headers, origin: "https://evil.example" },
        body: JSON.stringify({ integration: "github" }),
      }),
    );
    expect(evil.status).toBe(403);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("needs a signed-in user", async () => {
    const errors = await import("@/lib/security/errors");
    getVerifiedUser.mockRejectedValue(errors.unauthenticated());
    expect((await post({ integration: "github" })).status).toBe(401);
  });
});

describe("project covers", () => {
  it("is stable per id and within range", () => {
    expect(coverVariant("abc")).toBe(coverVariant("abc"));
    for (const id of ["a", "b", "11111111-1111-4111-8111-111111111111", ""]) {
      const variant = coverVariant(id);
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThan(COVER_VARIANTS);
    }
  });
});
