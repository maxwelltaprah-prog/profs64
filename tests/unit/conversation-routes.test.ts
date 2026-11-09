import { beforeEach, describe, expect, it, vi } from "vitest";

const CONVERSATION = "33333333-3333-4333-8333-333333333333";
const DOC = "44444444-4444-4444-8444-444444444444";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getConversation = vi.hoisted(() => vi.fn());
const getConversationDocument = vi.hoisted(() => vi.fn());
const createConversation = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/conversations", () => ({
  getConversation,
  getConversationDocument,
  createConversation,
  listConversations: async () => [],
}));
vi.mock("@/lib/db/service", () => ({ recordAuditEvent }));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      update: (values: unknown) => ({ eq: async () => update(values) }),
      delete: () => ({ eq: async () => remove() }),
    }),
  }),
}));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

type Handler = (request: Request, context: never) => Promise<Response>;
const headers = {
  origin: "https://app.example",
  host: "app.example",
  "content-type": "application/json",
};
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;
const errors = () => import("@/lib/security/errors");

beforeEach(() => {
  vi.resetModules();
  for (const fn of [
    getVerifiedUser,
    getConversation,
    getConversationDocument,
    createConversation,
    recordAuditEvent,
    enforceLimits,
    update,
    remove,
  ])
    fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  getConversation.mockResolvedValue({ id: CONVERSATION, title: "t", updatedAt: "" });
  enforceLimits.mockResolvedValue(undefined);
  update.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  recordAuditEvent.mockResolvedValue(undefined);
});

describe("document download", () => {
  const download = async () => {
    const { GET } = (await import("@/app/api/conversations/[id]/documents/[docId]/route")) as {
      GET: Handler;
    };
    return GET(
      new Request(`https://app.example/api/conversations/${CONVERSATION}/documents/${DOC}`),
      ctx({ id: CONVERSATION, docId: DOC }),
    );
  };

  it("renders the stored outline as an attachment with the right type and a safe name", async () => {
    getConversationDocument.mockResolvedValue({
      id: DOC,
      kind: "pdf",
      title: 'Plan "Q4"/../x',
      spec: { title: "Plan", blocks: [{ type: "paragraph", text: "Hello" }] },
    });
    const response = await download();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Plan-Q4x.pdf"');
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe("%PDF-");
  });

  it("is a 404 for someone else's document and fails cleanly on a broken outline", async () => {
    getConversationDocument.mockRejectedValue((await errors()).notFound());
    expect((await download()).status).toBe(404);
    getConversationDocument.mockResolvedValue({
      id: DOC,
      kind: "docx",
      title: "x",
      spec: { nonsense: true },
    });
    const broken = await download();
    expect(broken.status).toBe(500);
    expect(JSON.stringify(await broken.json())).not.toContain("nonsense");
  });

  it("needs sign-in and is rate limited", async () => {
    enforceLimits.mockRejectedValue((await errors()).rateLimited(10));
    expect((await download()).status).toBe(429);
    getVerifiedUser.mockRejectedValue((await errors()).unauthenticated());
    expect((await download()).status).toBe(401);
    expect(getConversationDocument).not.toHaveBeenCalled();
  });
});

describe("conversation management", () => {
  it("creates with a validated title", async () => {
    const { POST } = (await import("@/app/api/conversations/route")) as { POST: Handler };
    createConversation.mockResolvedValue({ id: CONVERSATION, title: "Hi", updatedAt: "" });
    const ok = await POST(
      new Request("https://app.example/api/conversations", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Hi" }),
      }),
      ctx({}),
    );
    expect(ok.status).toBe(201);
    for (const body of [
      {},
      { title: "" },
      { title: "x".repeat(121) },
      { title: "ok", owner_id: "someone" },
    ]) {
      const bad = await POST(
        new Request("https://app.example/api/conversations", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
        ctx({}),
      );
      expect(bad.status, JSON.stringify(body)).toBe(422);
    }
    expect(createConversation).toHaveBeenCalledTimes(1);
  });

  it("renames and deletes only conversations the caller owns", async () => {
    const route = (await import("@/app/api/conversations/[id]/route")) as {
      PATCH: Handler;
      DELETE: Handler;
    };
    const patch = () =>
      route.PATCH(
        new Request(`https://app.example/api/conversations/${CONVERSATION}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ title: "New" }),
        }),
        ctx({ id: CONVERSATION }),
      );
    const del = () =>
      route.DELETE(
        new Request(`https://app.example/api/conversations/${CONVERSATION}`, {
          method: "DELETE",
          headers,
        }),
        ctx({ id: CONVERSATION }),
      );
    expect((await patch()).status).toBe(200);
    expect(update.mock.calls[0]?.[0]).toMatchObject({ title: "New" });
    expect((await del()).status).toBe(204);
    getConversation.mockRejectedValue((await errors()).notFound());
    expect((await patch()).status).toBe(404);
    expect((await del()).status).toBe(404);
    expect(update).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("records a stop for the conversation only", async () => {
    const { POST } = (await import("@/app/api/conversations/[id]/stop/route")) as { POST: Handler };
    const response = await POST(
      new Request(`https://app.example/api/conversations/${CONVERSATION}/stop`, {
        method: "POST",
        headers,
      }),
      ctx({ id: CONVERSATION }),
    );
    expect(response.status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "chat_stop", metadata: { conversationId: CONVERSATION } }),
    );
  });
});
