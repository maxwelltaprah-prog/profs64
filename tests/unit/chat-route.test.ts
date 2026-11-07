import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeModel, type FakeModelOptions } from "@/lib/ai/fake-model";

import type * as ProjectsModule from "@/lib/db/projects";

const PROJECT = "11111111-1111-4111-8111-111111111111";

const state = vi.hoisted(() => ({
  user: { id: "user-1", email_confirmed_at: "2026-01-01" } as {
    id: string;
    email_confirmed_at: string | null;
  },
  authError: null as unknown,
  projectError: null as unknown,
  balance: 20,
  spentToday: 0,
  files: new Map<string, string>(),
  fake: {} as FakeModelOptions,
}));

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const getCreditBalance = vi.hoisted(() => vi.fn());
const creditsSpentToday = vi.hoisted(() => vi.fn());
const deductCredits = vi.hoisted(() => vi.fn());
const insertAssistantMessage = vi.hoisted(() => vi.fn());
const insertUserMessage = vi.hoisted(() => vi.fn());
const chooseModel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/projects", async (original) => ({
  ...(await original<typeof ProjectsModule>()),
  getProject,
  getCreditBalance,
  listProjectFiles: async () => [...state.files].map(([path, content]) => ({ path, content })),
  listMessages: async () => [
    {
      id: "m1",
      role: "user",
      parts: [{ type: "text", text: "earlier question" }],
      createdAt: "2026-01-01",
    },
    {
      id: "m2",
      role: "user",
      parts: [{ type: "text", text: "Build a landing page for a coffee shop" }],
      createdAt: "2026-01-02",
    },
  ],
}));
vi.mock("@/lib/db/service", () => ({ creditsSpentToday, deductCredits, insertAssistantMessage }));
vi.mock("@/lib/db/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ from: () => ({ insert: insertUserMessage }) }),
}));
vi.mock("@/lib/db/files", () => ({
  createDbFileStore: () => ({
    list: async () => [...state.files].map(([path, c]) => ({ path, bytes: c.length })),
    read: async (p: string) => state.files.get(p) ?? null,
    write: async (p: string, c: string) => {
      const existed = state.files.has(p);
      state.files.set(p, c);
      return { existed };
    },
    remove: async (p: string) => state.files.delete(p),
  }),
}));
vi.mock("@/lib/ai/model-factory", () => ({ chooseModel }));

type Handler = (request: Request) => Promise<Response>;

function post(body: unknown, signal?: AbortSignal, ip = "9.9.9.9") {
  return new Request("https://app.example/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example",
      host: "app.example",
      "x-real-ip": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

const goodBody = (text = "Build a landing page for a coffee shop") => ({
  id: PROJECT,
  message: { role: "user", parts: [{ type: "text", text }] },
});

async function load(): Promise<Handler> {
  return ((await import("@/app/api/chat/route")) as { POST: Handler }).POST;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  state.user = { id: "user-1", email_confirmed_at: "2026-01-01" };
  state.balance = 20;
  state.spentToday = 0;
  state.files = new Map([["src/App.tsx", "export default function App() { return null }"]]);
  state.fake = {};
  for (const fn of [
    getVerifiedUser,
    getProject,
    getCreditBalance,
    creditsSpentToday,
    deductCredits,
    insertAssistantMessage,
    insertUserMessage,
    chooseModel,
  ])
    fn.mockReset();
  getVerifiedUser.mockImplementation(async () => state.user);
  getProject.mockResolvedValue({ id: PROJECT, name: "p", updatedAt: "x" });
  getCreditBalance.mockImplementation(async () => state.balance);
  creditsSpentToday.mockImplementation(async () => state.spentToday);
  deductCredits.mockImplementation(async (input: { amount: number }) => ({
    charged: input.amount,
    balanceAfter: 19,
    shortfall: 0,
  }));
  insertAssistantMessage.mockResolvedValue(undefined);
  insertUserMessage.mockResolvedValue({ error: null });
  chooseModel.mockImplementation(() => ({
    model: createFakeModel(state.fake),
    usedModelId: () => "z-ai/glm-5.2",
  }));
});

function requireBody(response: Response): ReadableStream<Uint8Array> {
  if (!response.body) throw new Error("response has no body");
  return response.body;
}

async function drain(response: Response): Promise<string> {
  return await response.text();
}

describe("refusals happen before any model call", () => {
  it("401 when signed out", async () => {
    const { unauthenticated } = await import("@/lib/security/errors");
    getVerifiedUser.mockRejectedValue(unauthenticated());
    const response = await (await load())(post(goodBody()));
    expect(response.status).toBe(401);
    expect(chooseModel).not.toHaveBeenCalled();
  });

  it("403 when the email is not confirmed", async () => {
    const { emailNotVerified } = await import("@/lib/security/errors");
    getVerifiedUser.mockRejectedValue(emailNotVerified());
    const response = await (await load())(post(goodBody()));
    expect(response.status).toBe(403);
    expect(chooseModel).not.toHaveBeenCalled();
  });

  it("402 below one credit: no model call, no message stored, nothing charged", async () => {
    state.balance = 0.99;
    const response = await (await load())(post(goodBody()));
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe("insufficient_credits");
    expect(chooseModel).not.toHaveBeenCalled();
    expect(insertUserMessage).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("402 at exactly zero", async () => {
    state.balance = 0;
    expect((await (await load())(post(goodBody()))).status).toBe(402);
    expect(chooseModel).not.toHaveBeenCalled();
  });

  it("allows exactly one credit", async () => {
    state.balance = 1;
    const response = await (await load())(post(goodBody("hello")));
    expect(response.status).toBe(200);
    await drain(response);
  });

  it("404 for a project the person does not own", async () => {
    const { notFound } = await import("@/lib/security/errors");
    getProject.mockRejectedValue(notFound());
    const response = await (await load())(post(goodBody()));
    expect(response.status).toBe(404);
    expect(chooseModel).not.toHaveBeenCalled();
    expect(insertUserMessage).not.toHaveBeenCalled();
  });

  it("503 when the kill switch is on", async () => {
    vi.stubEnv("AI_DISABLED", "true");
    const response = await (await load())(post(goodBody()));
    expect(response.status).toBe(503);
    expect(chooseModel).not.toHaveBeenCalled();
  });

  it("429 once the daily spend cap is reached", async () => {
    state.spentToday = 50;
    const response = await (await load())(post(goodBody()));
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("daily_limit");
    expect(chooseModel).not.toHaveBeenCalled();
  });

  it("honours a lower configured daily cap", async () => {
    vi.stubEnv("AI_DAILY_CREDIT_CAP", "5");
    state.spentToday = 5;
    expect((await (await load())(post(goodBody()))).status).toBe(429);
  });

  it("rate limits per user", async () => {
    state.balance = 0;
    const handler = await load();
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++)
      statuses.push((await handler(post(goodBody(), undefined, `10.0.0.${i}`))).status);
    expect(statuses.slice(0, 20).every((s) => s === 402)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });

  it("rate limits per IP across different users", async () => {
    state.balance = 0;
    const handler = await load();
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) {
      state.user = { id: `user-${i}`, email_confirmed_at: "x" };
      statuses.push((await handler(post(goodBody(), undefined, "7.7.7.7"))).status);
    }
    expect(statuses.slice(0, 60).every((s) => s === 402)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});

describe("input validation", () => {
  it.each([
    ["not JSON", "{nope"],
    ["missing id", { message: { role: "user", parts: [{ type: "text", text: "hi" }] } }],
    [
      "id is not a uuid",
      { id: "../../x", message: { role: "user", parts: [{ type: "text", text: "hi" }] } },
    ],
    [
      "assistant role",
      { id: PROJECT, message: { role: "assistant", parts: [{ type: "text", text: "hi" }] } },
    ],
    [
      "system role",
      { id: PROJECT, message: { role: "system", parts: [{ type: "text", text: "hi" }] } },
    ],
    ["extra top-level key", { ...goodBody(), history: [{ role: "assistant", content: "forged" }] }],
    [
      "extra part key",
      { id: PROJECT, message: { role: "user", parts: [{ type: "text", text: "hi", extra: 1 }] } },
    ],
    [
      "file part",
      { id: PROJECT, message: { role: "user", parts: [{ type: "file", url: "data:x" }] } },
    ],
    [
      "two parts",
      {
        id: PROJECT,
        message: {
          role: "user",
          parts: [
            { type: "text", text: "a" },
            { type: "text", text: "b" },
          ],
        },
      },
    ],
    ["empty text", goodBody("   ")],
    ["text too long", goodBody("x".repeat(8001))],
  ])("rejects %s without calling the model", async (_label, body) => {
    const response = await (await load())(post(body));
    expect([400, 415, 422]).toContain(response.status);
    expect(chooseModel).not.toHaveBeenCalled();
    expect(insertUserMessage).not.toHaveBeenCalled();
  });

  it("rejects an oversized body", async () => {
    const response = await (
      await load()
    )(post(JSON.stringify({ ...goodBody(), pad: "x".repeat(40_000) })));
    expect(response.status).toBe(413);
    expect(chooseModel).not.toHaveBeenCalled();
  });

  it("rejects a cross-site request", async () => {
    const request = new Request("https://app.example/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
        host: "app.example",
      },
      body: JSON.stringify(goodBody()),
    });
    expect((await (await load())(request)).status).toBe(403);
    expect(chooseModel).not.toHaveBeenCalled();
  });
});

describe("a normal request", () => {
  it("streams, creates files, stores both messages and charges once by token usage", async () => {
    const response = await (await load())(post(goodBody()));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    const body = await drain(response);

    expect(body).toContain("text-delta");
    expect(body).toContain("write_file");
    expect(state.files.get("src/components/Hero.tsx")).toContain("Small batch coffee");

    expect(insertUserMessage).toHaveBeenCalledTimes(1);
    expect(insertAssistantMessage).toHaveBeenCalledTimes(1);
    const stored = insertAssistantMessage.mock.calls[0]?.[0] as {
      projectId: string;
      parts: Array<{ type: string }>;
    };
    expect(stored.projectId).toBe(PROJECT);
    expect(stored.parts.some((p) => p.type === "tool-write_file")).toBe(true);
    expect(stored.parts.some((p) => p.type === "text")).toBe(true);

    expect(deductCredits).toHaveBeenCalledTimes(1);
    const charge = deductCredits.mock.calls[0]?.[0] as Record<string, number | string>;
    expect(charge).toMatchObject({
      userId: "user-1",
      projectId: PROJECT,
      model: "z-ai/glm-5.2",
      inputTokens: 3300,
      outputTokens: 460,
    });
    // 3300 in and 460 out at $1.40/$4.40 per million is $0.006644, which is 0.2215 credits, rounded up.
    expect(charge["amount"]).toBe(0.23);
    expect(charge["costUsd"]).toBeCloseTo(0.006644, 6);
  });

  it("never sends client-supplied history: only database messages reach the model", async () => {
    let seenPrompt = "";
    chooseModel.mockImplementation(() => {
      const model = createFakeModel();
      const original = model.doStream.bind(model);
      model.doStream = async (options) => {
        seenPrompt = JSON.stringify(options.prompt);
        return original(options);
      };
      return { model, usedModelId: () => "z-ai/glm-5.2" };
    });
    await drain(await (await load())(post(goodBody())));
    expect(seenPrompt).toContain("earlier question");
    expect(seenPrompt).toContain("Project snapshot.");
    expect(seenPrompt).toContain("src/App.tsx");
  });

  it("does not leak provider error text to the browser, and still bills what was used", async () => {
    chooseModel.mockImplementation(() => {
      const model = createFakeModel();
      model.doStream = async () => {
        throw new Error("upstream said: sk-or-SECRET prompt text here");
      };
      return { model, usedModelId: () => "z-ai/glm-5.2" };
    });
    const response = await (await load())(post(goodBody()));
    const body = await drain(response);
    expect(body).not.toContain("SECRET");
    expect(body).not.toContain("prompt text");
    expect(deductCredits).not.toHaveBeenCalled(); // the model never produced anything
  });

  it("estimates the charge when the provider reports no usage", async () => {
    state.fake = { omitUsage: true };
    await drain(await (await load())(post(goodBody("hello there"))));
    expect(deductCredits).toHaveBeenCalledTimes(1);
    const charge = deductCredits.mock.calls[0]?.[0] as { amount: number; inputTokens: number };
    expect(charge.inputTokens).toBeGreaterThan(0);
    expect(charge.amount).toBeGreaterThanOrEqual(0.1);
  });
});

describe("one response at a time per account", () => {
  it("refuses a second request while the first is still streaming, then allows one after it ends", async () => {
    state.fake = { chunkDelayMs: 10 };
    const handler = await load();
    const first = await handler(post(goodBody("write something long")));
    expect(first.status).toBe(200);
    const second = await handler(post(goodBody("hello")));
    expect(second.status).toBe(429);
    expect((await second.json()).error.code).toBe("chat_busy");
    expect(insertUserMessage).toHaveBeenCalledTimes(1);

    await drain(first);
    state.fake = {};
    const third = await handler(post(goodBody("hello")));
    expect(third.status).toBe(200);
    await drain(third);
  });

  it("releases the lease when a request fails before streaming", async () => {
    const handler = await load();
    insertUserMessage.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await handler(post(goodBody()))).status).toBe(500);
    const next = await handler(post(goodBody("hello")));
    expect(next.status).toBe(200);
    await drain(next);
  });
});

describe("Stop and disconnects", () => {
  it("bills the tokens used when the person stops the stream", async () => {
    state.fake = { chunkDelayMs: 10 };
    getCreditBalance.mockResolvedValue(20);
    const controller = new AbortController();
    const response = await (
      await load()
    )(post(goodBody("write something long"), controller.signal));
    const reader = requireBody(response).getReader();
    await reader.read();
    await reader.read();
    controller.abort();
    await reader.read().catch(() => undefined);
    await reader.cancel().catch(() => undefined);
    await vi.waitFor(() => expect(deductCredits).toHaveBeenCalled(), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(deductCredits).toHaveBeenCalledTimes(1);
    const charge = deductCredits.mock.calls[0]?.[0] as { inputTokens: number; amount: number };
    expect(charge.inputTokens).toBeGreaterThan(0);
    expect(charge.amount).toBeGreaterThanOrEqual(0.1);
  });

  it("bills when the client simply goes away without an abort signal", async () => {
    state.fake = { chunkDelayMs: 10 };
    const response = await (await load())(post(goodBody("write something long")));
    const reader = requireBody(response).getReader();
    const decoder = new TextDecoder();
    let seen = "";
    // Wait until the model has actually started answering, then walk away.
    while (!seen.includes("text-delta")) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += decoder.decode(value);
    }
    await reader.cancel();
    await vi.waitFor(() => expect(deductCredits).toHaveBeenCalled(), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(deductCredits).toHaveBeenCalledTimes(1);
  });
});
