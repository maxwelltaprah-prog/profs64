import { beforeEach, describe, expect, it, vi } from "vitest";

const CONVO = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "22222222-2222-4222-8222-222222222222";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getConversation = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
const found = vi.hoisted(() => ({ value: null as { id: string } | null }));

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/conversations", () => ({ getConversation }));
vi.mock("@/lib/db/service", () => ({ recordAuditEvent }));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: found.value }) }) }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const put = async (body: unknown, ids = { id: CONVO, messageId: MESSAGE }) => {
  const { PUT } =
    (await import("@/app/api/conversations/[id]/messages/[messageId]/feedback/route")) as {
      PUT: (r: Request, c: never) => Promise<Response>;
    };
  return PUT(
    new Request("https://app.example/x", {
      method: "PUT",
      headers: {
        origin: "https://app.example",
        host: "app.example",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve(ids) } as never,
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [getVerifiedUser, getConversation, recordAuditEvent, enforceLimits])
    fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  getConversation.mockResolvedValue({ id: CONVO });
  recordAuditEvent.mockResolvedValue(undefined);
  enforceLimits.mockResolvedValue(undefined);
  found.value = { id: MESSAGE };
});

describe("PUT /api/conversations/[id]/messages/[messageId]/feedback", () => {
  it("records the rating with ids only", async () => {
    const response = await put({ rating: "up" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rating: "up" });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "message_feedback",
        metadata: { conversationId: CONVO, messageId: MESSAGE, rating: "up" },
      }),
    );
  });
  it("clears with none", async () => {
    expect(await (await put({ rating: "none" })).json()).toEqual({ rating: null });
  });
  it("is a 404 for a reply that is not in the conversation, and for bad ids", async () => {
    found.value = null;
    expect((await put({ rating: "up" })).status).toBe(404);
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect((await put({ rating: "up" }, { id: "x", messageId: MESSAGE })).status).toBe(404);
  });
  it("rejects a bad body", async () => {
    expect((await put({ rating: "meh" })).status).toBe(422);
    expect((await put({ rating: "up", extra: 1 })).status).toBe(422);
  });
});
