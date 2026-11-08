import { beforeEach, describe, expect, it, vi } from "vitest";

const getVerifiedUser = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const listMessages = vi.hoisted(() => vi.fn());
const listRatings = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());
const enforceLimits = vi.hoisted(() => vi.fn());
const write = vi.hoisted(() => vi.fn());
const messageLookup = vi.hoisted(() => vi.fn());

// Errors are built after vi.resetModules() so they are the same class the route imports.
const errors = () => import("@/lib/security/errors");

vi.mock("@/lib/db/auth", () => ({ getVerifiedUser }));
vi.mock("@/lib/db/projects", async (original) => ({
  ...(await original()),
  getProject,
  listMessages,
}));
vi.mock("@/lib/db/outputs", async (original) => ({
  ...(await original()),
  listRatings,
}));
vi.mock("@/lib/db/service", () => ({ recordAuditEvent }));
vi.mock("@/lib/db/files", () => ({ createDbFileStore: () => ({ write }) }));
vi.mock("@/lib/db/supabase-server", () => ({
  // from("messages").select().eq().eq().eq().maybeSingle()
  createSupabaseServerClient: async () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain["select"] = () => chain;
      chain["eq"] = () => chain;
      chain["maybeSingle"] = messageLookup;
      return chain;
    },
  }),
}));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original()),
  enforceLimits,
}));

const PROJECT = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "22222222-2222-4222-8222-222222222222";
const headers = {
  "content-type": "application/json",
  origin: "https://app.example",
  host: "app.example",
};

// The routes type their context per route; the tests drive them with plain records.
type Handler = (request: Request, context: never) => Promise<Response>;

const feedback = async (
  body: unknown,
  { project = PROJECT, message = MESSAGE, extra = {} as Record<string, string> } = {},
) => {
  const { PUT } = (await import("@/app/api/projects/[id]/messages/[messageId]/feedback/route")) as {
    PUT: Handler;
  };
  return PUT(
    new Request(`https://app.example/api/projects/${project}/messages/${message}/feedback`, {
      method: "PUT",
      headers: { ...headers, ...extra },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: project, messageId: message }) } as never,
  );
};

const attach = async (
  body: unknown,
  { project = PROJECT, extra = {} as Record<string, string> } = {},
) => {
  const { POST } = (await import("@/app/api/projects/[id]/files/route")) as { POST: Handler };
  return POST(
    new Request(`https://app.example/api/projects/${project}/files`, {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: project }) } as never,
  );
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [
    getVerifiedUser,
    getProject,
    listMessages,
    listRatings,
    recordAuditEvent,
    enforceLimits,
    write,
    messageLookup,
  ])
    fn.mockReset();
  getVerifiedUser.mockResolvedValue({ id: "user-1" });
  getProject.mockResolvedValue({ id: PROJECT, name: "p", updatedAt: "" });
  enforceLimits.mockResolvedValue(undefined);
  messageLookup.mockResolvedValue({ data: { id: MESSAGE }, error: null });
  recordAuditEvent.mockResolvedValue(undefined);
  write.mockResolvedValue({ existed: false });
});

describe("PUT /api/projects/[id]/messages/[messageId]/feedback", () => {
  it("records the rating against the caller, with ids and the rating only", async () => {
    const response = await feedback({ rating: "up" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rating: "up" });
    expect(recordAuditEvent).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      event: "message_feedback",
      metadata: { projectId: PROJECT, messageId: MESSAGE, rating: "up" },
      requestId: expect.any(String),
    });
  });

  it("clears a rating", async () => {
    const response = await feedback({ rating: "none" });
    expect(await response.json()).toEqual({ rating: null });
    expect(recordAuditEvent.mock.calls[0]?.[0].metadata.rating).toBe("none");
  });

  it("rejects anything but up, down or none, extra keys, bad ids and the wrong content type", async () => {
    for (const body of [{ rating: "love" }, { rating: "up", note: "x" }, {}, "not json"]) {
      expect((await feedback(body)).status, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
    }
    expect((await feedback({ rating: "up" }, { message: "../x" })).status).toBe(404);
    expect(
      (await feedback({ rating: "up" }, { extra: { "content-type": "text/plain" } })).status,
    ).toBe(415);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("is a 404 for a message that is not an assistant reply in the caller's project", async () => {
    messageLookup.mockResolvedValue({ data: null, error: null });
    expect((await feedback({ rating: "up" })).status).toBe(404);
    getProject.mockRejectedValue((await errors()).notFound());
    expect((await feedback({ rating: "up" })).status).toBe(404);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("needs a verified sign-in, a same-origin request, and respects the rate limit", async () => {
    getVerifiedUser.mockRejectedValue((await errors()).unauthenticated());
    expect((await feedback({ rating: "up" })).status).toBe(401);
    getVerifiedUser.mockResolvedValue({ id: "user-1" });
    expect(
      (await feedback({ rating: "up" }, { extra: { origin: "https://evil.example" } })).status,
    ).toBe(403);
    enforceLimits.mockRejectedValue((await errors()).rateLimited(30));
    expect((await feedback({ rating: "up" })).status).toBe(429);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/projects/[id]/files (attachments)", () => {
  it("stores text files under attachments/ through the project file store", async () => {
    const response = await attach({
      files: [
        { name: "menu.md", content: "# Menu" },
        { name: "Q3 Report.csv", content: "a,b\n1,2" },
      ],
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      paths: ["attachments/menu.md", "attachments/Q3-Report.csv.txt"],
    });
    expect(write).toHaveBeenNthCalledWith(1, "attachments/menu.md", "# Menu");
    expect(write).toHaveBeenNthCalledWith(2, "attachments/Q3-Report.csv.txt", "a,b\n1,2");
  });

  it("turns a traversal attempt into a harmless name inside attachments/", async () => {
    const response = await attach({ files: [{ name: "../../etc/passwd", content: "x" }] });
    expect(response.status).toBe(201);
    const path = write.mock.calls[0]?.[0] as string;
    expect(path.startsWith("attachments/")).toBe(true);
    expect(path).not.toContain("..");
    expect(path.split("/")).toHaveLength(2);
  });

  it("rejects binary, empty and oversized files, and writes nothing", async () => {
    for (const file of [
      { name: "a.png", content: "\u0000PNG" },
      { name: "a.md", content: "   " },
      { name: "a.md", content: "x".repeat(101 * 1024) },
      { name: "....", content: "text" },
    ]) {
      expect((await attach({ files: [file] })).status, file.name).toBe(400);
    }
    // One bad file stops the whole request before anything is stored.
    expect(
      (
        await attach({
          files: [
            { name: "ok.md", content: "fine" },
            { name: "bad.md", content: "\u0000" },
          ],
        })
      ).status,
    ).toBe(400);
    expect(write).not.toHaveBeenCalled();
  });

  it("validates the body: 1 to 3 files, known keys only, bounded size", async () => {
    expect((await attach({ files: [] })).status).toBeGreaterThanOrEqual(400);
    expect(
      (await attach({ files: Array.from({ length: 4 }, () => ({ name: "a.md", content: "x" })) }))
        .status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await attach({ files: [{ name: "a.md", content: "x", path: "src/App.tsx" }] })).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await attach({ files: [{ name: "a.md", content: "x".repeat(600 * 1024) }] })).status,
    ).toBe(413);
    expect(write).not.toHaveBeenCalled();
  });

  it("is a 404 for someone else's project, needs sign-in and same origin, and is rate limited", async () => {
    getProject.mockRejectedValue((await errors()).notFound());
    expect((await attach({ files: [{ name: "a.md", content: "x" }] })).status).toBe(404);
    getProject.mockResolvedValue({ id: PROJECT });
    getVerifiedUser.mockRejectedValue((await errors()).unauthenticated());
    expect((await attach({ files: [{ name: "a.md", content: "x" }] })).status).toBe(401);
    getVerifiedUser.mockResolvedValue({ id: "user-1" });
    expect(
      (
        await attach(
          { files: [{ name: "a.md", content: "x" }] },
          { extra: { origin: "https://evil.example" } },
        )
      ).status,
    ).toBe(403);
    enforceLimits.mockRejectedValue((await errors()).rateLimited(30));
    expect((await attach({ files: [{ name: "a.md", content: "x" }] })).status).toBe(429);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("GET /api/projects/[id]/outputs", () => {
  it("returns credits and the caller's rating for each assistant reply only", async () => {
    listMessages.mockResolvedValue([
      { id: "u", role: "user", parts: [{ type: "text", text: "hi" }], createdAt: "" },
      {
        id: MESSAGE,
        role: "assistant",
        parts: [
          { type: "text", text: "done" },
          { type: "data-usage", data: { credits: 0.5, inputTokens: 10, outputTokens: 5 } },
        ],
        createdAt: "",
      },
      { id: "old", role: "assistant", parts: [{ type: "text", text: "older" }], createdAt: "" },
    ]);
    listRatings.mockResolvedValue(new Map([[MESSAGE, "down"]]));
    const { GET } = (await import("@/app/api/projects/[id]/outputs/route")) as { GET: Handler };
    const response = await GET(new Request(`https://app.example/api/projects/${PROJECT}/outputs`), {
      params: Promise.resolve({ id: PROJECT }),
    } as never);
    expect(await response.json()).toEqual({
      outputs: {
        [MESSAGE]: { usage: { credits: 0.5, inputTokens: 10, outputTokens: 5 }, rating: "down" },
        old: { usage: null, rating: null },
      },
    });
  });
});
