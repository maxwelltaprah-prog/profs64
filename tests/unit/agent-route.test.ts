import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeModel } from "@/lib/ai/fake-model";

const CONVERSATION = "33333333-3333-4333-8333-333333333333";

const state = vi.hoisted(() => ({
  balance: 20,
  spentToday: 0,
  freeStart: null as Date | null,
  stored: [] as Array<{
    id: string;
    role: "user" | "assistant";
    parts: unknown[];
    createdAt: string;
  }>,
}));

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getConversation = vi.hoisted(() => vi.fn());
const deductCredits = vi.hoisted(() => vi.fn());
const insertAssistant = vi.hoisted(() => vi.fn());
const insertDocument = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const insertUserMessage = vi.hoisted(() => vi.fn());
const chooseModel = vi.hoisted(() => vi.fn());
const chooseFreeModel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/conversations", () => ({
  getConversation,
  latestFreeWindowStart: async () => state.freeStart,
  listConversationMessages: async () => state.stored,
}));
vi.mock("@/lib/db/projects", async (original) => ({
  ...(await original()),
  getCreditBalance: async () => state.balance,
}));
vi.mock("@/lib/db/service", () => ({
  creditsSpentToday: async () => state.spentToday,
  deductCredits,
  insertConversationAssistantMessage: insertAssistant,
  insertConversationDocument: insertDocument,
  recordAuditEvent,
  touchConversation: async () => undefined,
}));
vi.mock("@/lib/db/stop", () => ({
  latestStopId: async () => 0,
  stopRequestedSince: async () => false,
}));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ from: () => ({ insert: insertUserMessage }) }),
}));
vi.mock("@/lib/ai/model-factory", () => ({ chooseModel, chooseFreeModel }));

type Handler = (request: Request, context: never) => Promise<Response>;

const send = async (text: string, extra: Record<string, string> = {}) => {
  const { POST } = (await import("@/app/api/conversations/[id]/chat/route")) as { POST: Handler };
  return POST(
    new Request(`https://app.example/api/conversations/${CONVERSATION}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.example",
        host: "app.example",
        "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200)}`,
        ...extra,
      },
      body: JSON.stringify({ message: { role: "user", parts: [{ type: "text", text }] } }),
    }),
    { params: Promise.resolve({ id: CONVERSATION }) } as never,
  );
};

const drain = async (response: Response) => {
  const text = await response.text();
  await new Promise((resolve) => setTimeout(resolve, 30));
  return text;
};

beforeEach(() => {
  vi.resetModules();
  state.balance = 20;
  state.spentToday = 0;
  state.freeStart = null;
  state.stored = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "hello there" }], createdAt: "" },
  ];
  for (const fn of [
    getVerifiedUser,
    getConversation,
    deductCredits,
    insertAssistant,
    insertDocument,
    recordAuditEvent,
    insertUserMessage,
    chooseModel,
    chooseFreeModel,
  ])
    fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1", email_confirmed_at: "2026-01-01" });
  getConversation.mockResolvedValue({ id: CONVERSATION, title: "t", updatedAt: "" });
  deductCredits.mockImplementation(async (input: { amount: number }) => ({
    charged: input.amount,
    balanceAfter: 10,
    shortfall: 0,
  }));
  insertAssistant.mockResolvedValue(undefined);
  insertDocument.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" });
  recordAuditEvent.mockResolvedValue(undefined);
  insertUserMessage.mockResolvedValue({ error: null });
  chooseModel.mockImplementation(() => ({
    model: createFakeModel(),
    usedModelId: () => "z-ai/glm-5.2",
  }));
  chooseFreeModel.mockImplementation(() => ({
    model: createFakeModel(),
    usedModelId: () => "google/gemma-4-31b-it:free",
  }));
});

describe("chat agent with credits", () => {
  it("answers on the paid model, bills once and stores the reply with its usage", async () => {
    const response = await send("hello there");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-buildr-mode")).toBe("paid");
    await drain(response);
    expect(chooseFreeModel).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(deductCredits).toHaveBeenCalledTimes(1));
    expect(deductCredits.mock.calls[0]?.[0]).toMatchObject({ projectId: null });
    await vi.waitFor(() => expect(insertAssistant).toHaveBeenCalled());
    const parts = insertAssistant.mock.calls[0]?.[0].parts as Array<{ type: string }>;
    expect(parts.some((part) => part.type === "data-usage")).toBe(true);
  });

  it("creates a document through the tool and stores only a stub of its outline", async () => {
    state.stored = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "make slides" }], createdAt: "" },
    ];
    const text = await drain(await send("make slides"));
    expect(insertDocument).toHaveBeenCalledWith({
      conversationId: CONVERSATION,
      kind: "pptx",
      title: "Team update",
      spec: expect.objectContaining({ title: "Team update" }),
    });
    expect(text).toContain("44444444-4444-4444-8444-444444444444");
    await vi.waitFor(() => expect(insertAssistant).toHaveBeenCalled());
    const parts = insertAssistant.mock.calls[0]?.[0].parts as Array<Record<string, unknown>>;
    const call = parts.find((part) => part["type"] === "tool-create_document");
    expect(call?.["input"]).toEqual({ kind: "pptx" });
  });
});

describe("free fallback when credits run out", () => {
  it("opens a 24-hour free window, uses the free model and never bills", async () => {
    state.balance = 0;
    const response = await send("hello there");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-buildr-mode")).toBe("free");
    const until = Date.parse(response.headers.get("x-buildr-free-until") ?? "");
    expect(until - Date.now()).toBeGreaterThan(23.9 * 3600 * 1000);
    await drain(response);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "free_window_started" }),
    );
    expect(chooseModel).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(insertAssistant).toHaveBeenCalled());
    const parts = insertAssistant.mock.calls[0]?.[0].parts as Array<{ type: string }>;
    expect(parts.map((part) => part.type)).toContain("data-free");
    expect(parts.map((part) => part.type)).not.toContain("data-usage");
  });

  it("does not start a free window for a request rejected as busy", async () => {
    state.balance = 0;
    chooseFreeModel.mockImplementation(() => ({
      model: createFakeModel({ chunkDelayMs: 20 }),
      usedModelId: () => "google/gemma-4-31b-it:free",
    }));
    const first = await send("hello there");
    expect(first.status).toBe(200);
    const second = await send("hello there");
    expect(second.status).toBe(429);
    expect((await second.json()).error.code).toBe("chat_busy");
    // Only the first request, which actually streamed, opened the window.
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    await drain(first);
  });

  it("also applies when the daily cap is reached, and reuses an open window", async () => {
    state.spentToday = 1000;
    state.freeStart = new Date(Date.now() - 2 * 3600 * 1000);
    const response = await send("hello there");
    expect(response.headers.get("x-buildr-mode")).toBe("free");
    await drain(response);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refuses after the window, until the cooldown ends, with the time it opens again", async () => {
    state.balance = 0;
    state.freeStart = new Date(Date.now() - 30 * 3600 * 1000);
    const response = await send("hello there");
    expect(response.status).toBe(402);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("free_window_used");
    expect(body.error.message).toContain("Free access is available again");
    expect(chooseFreeModel).not.toHaveBeenCalled();
  });
});

describe("abuse and access", () => {
  it("is a 404 for someone else's conversation and checks the body and origin", async () => {
    const errors = await import("@/lib/security/errors");
    getConversation.mockRejectedValue(errors.notFound());
    expect((await send("hello there")).status).toBe(404);
    getConversation.mockResolvedValue({ id: CONVERSATION });
    expect((await send("")).status).toBe(422);
    expect((await send("x".repeat(20_000))).status).toBeGreaterThanOrEqual(400);
    expect((await send("hi", { origin: "https://evil.example" })).status).toBe(403);
    getVerifiedUser.mockRejectedValue(errors.unauthenticated());
    expect((await send("hi")).status).toBe(401);
    expect(insertUserMessage).not.toHaveBeenCalled();
  });
});
