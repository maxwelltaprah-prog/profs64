import { beforeEach, describe, expect, it, vi } from "vitest";

import { png } from "./deck-visuals.test";

const CONVO = "11111111-1111-4111-8111-111111111111";
const getVerifiedUser = vi.hoisted(() => vi.fn());
const insertConversationImage = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/images", () => ({ insertConversationImage }));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const post = async (
  body: Uint8Array | string,
  query = "?name=a.png",
  origin = "https://app.example",
) => {
  const { POST } = (await import("@/app/api/conversations/[id]/images/route")) as {
    POST: (r: Request, c: never) => Promise<Response>;
  };
  return POST(
    new Request(`https://app.example/x${query}`, {
      method: "POST",
      headers: { origin, host: "app.example" },
      body: body as BodyInit,
    }),
    { params: Promise.resolve({ id: CONVO }) } as never,
  );
};

beforeEach(() => {
  vi.resetModules();
  getVerifiedUser.mockReset().mockResolvedValue({ id: "u1" });
  enforceLimits.mockReset().mockResolvedValue(undefined);
  insertConversationImage
    .mockReset()
    .mockImplementation(async (_id, image: Record<string, unknown>) => {
      const rest = { ...image };
      delete rest["data"];
      return { id: "img-1", ...rest };
    });
});

describe("POST /api/conversations/[id]/images", () => {
  it("stores a real PNG and returns its details, not its bytes", async () => {
    const response = await post(png(40, 30), "?name=%22%3Cb%3Elogo%3C%2Fb%3E.png");
    expect(response.status).toBe(201);
    const body = (await response.json()) as { image: Record<string, unknown> };
    expect(body.image).toMatchObject({ width: 40, height: 30, mime: "image/png" });
    expect(body.image["data"]).toBeUndefined();
    expect(insertConversationImage.mock.calls[0]?.[1].name).toBe("blogo/b.png".replace("/", ""));
  });
  it("rejects SVG, text and oversize bodies without storing anything", async () => {
    expect((await post('<svg xmlns="http://www.w3.org/2000/svg"/>'.padEnd(64))).status).toBe(400);
    expect((await post(new Uint8Array(2 * 1024 * 1024 + 10))).status).toBe(413);
    expect(insertConversationImage).not.toHaveBeenCalled();
  });
  it("blocks cross-origin posts and rate-limited users", async () => {
    expect((await post(png(4, 4), "?name=a", "https://evil.example")).status).toBe(403);
    enforceLimits.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 429 }));
    expect((await post(png(4, 4))).status).not.toBe(201);
  });
});
