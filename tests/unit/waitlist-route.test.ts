import { beforeEach, describe, expect, it, vi } from "vitest";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/service", () => ({ recordAuditEvent }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

type Handler = (request: Request) => Promise<Response>;
const headers = {
  "content-type": "application/json",
  origin: "https://app.example",
  host: "app.example",
};
const post = async (body: unknown) => {
  const { POST } = (await import("@/app/api/billing/waitlist/route")) as { POST: Handler };
  return POST(
    new Request("https://app.example/api/billing/waitlist", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
};
const errors = () => import("@/lib/security/errors");

beforeEach(() => {
  vi.resetModules();
  for (const fn of [getVerifiedUser, recordAuditEvent, enforceLimits]) fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  enforceLimits.mockResolvedValue(undefined);
  recordAuditEvent.mockResolvedValue(undefined);
});

describe("POST /api/billing/waitlist", () => {
  it("records interest with the pack id only", async () => {
    const response = await post({ pack: "builder" });
    expect(response.status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      event: "pack_waitlist",
      metadata: { pack: "builder" },
      requestId: expect.any(String),
    });
  });

  it("rejects unknown packs, extra keys and non-members", async () => {
    for (const body of [{ pack: "enterprise" }, {}, { pack: "builder", email: "x" }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
    }
    expect(recordAuditEvent).not.toHaveBeenCalled();
    getVerifiedUser.mockRejectedValue((await errors()).unauthenticated());
    expect((await post({ pack: "builder" })).status).toBe(401);
    getVerifiedUser.mockResolvedValue({ id: "user-1" });
    enforceLimits.mockRejectedValue((await errors()).rateLimited(10));
    expect((await post({ pack: "builder" })).status).toBe(429);
  });
});
