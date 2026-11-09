// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationView } from "@/components/chat/conversation-view";
import { NewChat } from "@/components/chat/new-chat";
import { documentStep, firstMessageKey, titleFromPrompt } from "@/lib/workspace/agent";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const CONVERSATION = "33333333-3333-4333-8333-333333333333";
const DOC = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  push.mockReset();
  window.sessionStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("agent helpers", () => {
  it("only trusts well-formed document results", () => {
    const done = {
      type: "tool-create_document",
      state: "output-available",
      output: { ok: true, id: DOC, kind: "pdf", title: "Plan" },
    };
    expect(documentStep(done)).toEqual({
      state: "done",
      document: { id: DOC, kind: "pdf", title: "Plan" },
    });
    for (const output of [
      { ok: true, id: "../../x", kind: "pdf", title: "x" },
      { ok: true, id: DOC, kind: "exe", title: "x" },
      { ok: true, id: DOC, kind: "pdf" },
    ])
      expect(documentStep({ ...done, output })?.state).toBe("failed");
    expect(documentStep({ type: "tool-create_document", state: "input-streaming" })).toEqual({
      state: "working",
    });
    expect(documentStep({ type: "text", text: "x" })).toBeNull();
  });

  it("makes short titles from the first line", () => {
    expect(titleFromPrompt("Make a deck\nabout things")).toBe("Make a deck");
    expect(titleFromPrompt("x".repeat(80))).toHaveLength(58);
    expect(titleFromPrompt("   ")).toBe("New chat");
  });
});

describe("NewChat", () => {
  it("creates the conversation, keeps the first message out of the URL and opens it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ conversation: { id: CONVERSATION } }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<NewChat greeting="What can I help with?" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Message"), "Make slides about the launch{Enter}");
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/chat/${CONVERSATION}`));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ title: "Make slides about the launch" });
    expect(window.sessionStorage.getItem(firstMessageKey(CONVERSATION))).toBe(
      "Make slides about the launch",
    );
  });

  it("fills the box from an idea and shows the server's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { message: "Too many chats today." } }, { status: 429 }),
        ),
    );
    render(<NewChat greeting="Hi" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Make a slide deck" }));
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toContain("PowerPoint");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Too many chats today.");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ConversationView", () => {
  const stored = [
    { id: "u1", role: "user" as const, parts: [{ type: "text" as const, text: "Make a plan" }] },
    {
      id: "a1",
      role: "assistant" as const,
      parts: [
        { type: "text", text: "Here is your **plan**." },
        {
          type: "tool-create_document",
          toolCallId: "t1",
          state: "output-available",
          input: { kind: "docx" },
          output: { ok: true, id: DOC, kind: "docx", title: "Plan" },
        },
        { type: "data-usage", data: { credits: 0.42, inputTokens: 10, outputTokens: 5 } },
      ],
    },
  ] as never;

  it("shows replies as text with a download card and the credits used", () => {
    const { container } = render(
      <ConversationView
        conversationId={CONVERSATION}
        initialMessages={stored}
        initialFreeUntil={null}
      />,
    );
    expect(screen.getByText("plan").tagName).toBe("STRONG");
    const link = screen.getByRole("link", { name: /download/i });
    expect(link.getAttribute("href")).toBe(`/api/conversations/${CONVERSATION}/documents/${DOC}`);
    expect(link.hasAttribute("download")).toBe(true);
    expect(screen.getByText("Word document · .docx")).toBeTruthy();
    expect(screen.getByText("0.42 credits")).toBeTruthy();
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("explains the free window when it is open", () => {
    render(
      <ConversationView
        conversationId={CONVERSATION}
        initialMessages={[]}
        initialFreeUntil="2026-11-10T12:00:00.000Z"
      />,
    );
    expect(screen.getByText(/replies use a free model until/)).toBeTruthy();
  });

  it("sends the first message from the new-chat screen once, to this conversation's endpoint", async () => {
    window.sessionStorage.setItem(firstMessageKey(CONVERSATION), "Hello agent");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("data: [DONE]\n\n", {
        headers: {
          "content-type": "text/event-stream",
          "x-buildr-mode": "free",
          "x-buildr-free-until": "2026-11-10T12:00:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ConversationView
        conversationId={CONVERSATION}
        initialMessages={[]}
        initialFreeUntil={null}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe(`/api/conversations/${CONVERSATION}/chat`);
    expect(JSON.parse(String(init.body))).toEqual({
      message: { role: "user", parts: [{ type: "text", text: "Hello agent" }] },
    });
    expect(window.sessionStorage.getItem(firstMessageKey(CONVERSATION))).toBeNull();
    expect(await screen.findByText(/replies use a free model until/)).toBeTruthy();
  });
});
