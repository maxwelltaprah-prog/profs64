// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/workspace/chat-panel";
import { createFakeModel, type FakeModelOptions } from "@/lib/ai/fake-model";
import { createProjectTools, type FileStore } from "@/lib/ai/tools";
import { readPendingPrompt, savePendingPrompt } from "@/lib/workspace/pending-prompt";

// Runs the real server-side pipeline (fake model, real tools, real UI stream encoding) behind a
// fake fetch, so the panel is tested against the exact wire format the route produces.
function installServer(files: Map<string, string>, fake: FakeModelOptions = {}) {
  const requests: unknown[] = [];
  const store: FileStore = {
    list: async () => [...files].map(([path, c]) => ({ path, bytes: c.length })),
    read: async (p) => files.get(p) ?? null,
    write: async (p, c) => {
      const existed = files.has(p);
      files.set(p, c);
      return { existed };
    },
    remove: async (p) => files.delete(p),
  };
  const impl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { message: { parts: Array<{ text: string }> } };
    requests.push(body);
    const tools = createProjectTools(store);
    const result = streamText({
      model: createFakeModel(fake),
      messages: [{ role: "user", content: body.message.parts[0]?.text ?? "" }],
      tools,
      stopWhen: isStepCount(12),
      ...(init?.signal ? { abortSignal: init.signal } : {}),
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream, tools }),
    });
  });
  vi.stubGlobal("fetch", impl);
  return { requests, impl };
}

function renderPanel(overrides: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  const onFilesChanged = vi.fn();
  const onFinished = vi.fn();
  render(
    <ChatPanel
      projectId="11111111-1111-4111-8111-111111111111"
      initialMessages={[]}
      canUseAssistant
      hasCredits
      onFilesChanged={onFilesChanged}
      onFinished={onFinished}
      {...overrides}
    />,
  );
  return { onFilesChanged, onFinished };
}

beforeEach(() => {
  HTMLElement.prototype.scrollTo = () => undefined;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("ChatPanel", () => {
  it("streams a reply, shows friendly file lines, and refreshes the tree", async () => {
    const files = new Map<string, string>();
    const { requests } = installServer(files);
    const { onFilesChanged, onFinished } = renderPanel();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message"), "Build a landing page for a coffee shop");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("Created src/components/Hero.tsx");
    await screen.findByText("Created src/App.tsx");
    await screen.findByText(/Done\. I updated the project files\./);
    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(onFilesChanged).toHaveBeenCalled();
    expect(files.has("src/components/Hero.tsx")).toBe(true);

    // Only the newest message and the project id are sent; no history, no extra keys.
    expect(requests).toHaveLength(1);
    expect(Object.keys(requests[0] as object).sort()).toEqual(["id", "message"]);
    expect((requests[0] as { message: unknown }).message).toEqual({
      role: "user",
      parts: [{ type: "text", text: "Build a landing page for a coffee shop" }],
    });
  });

  it("sends with Ctrl+Enter and keeps plain Enter for new lines", async () => {
    installServer(new Map());
    renderPanel();
    const user = userEvent.setup();
    const box = screen.getByLabelText("Message");
    await user.type(box, "first line{Enter}second line");
    expect((box as HTMLTextAreaElement).value).toBe("first line\nsecond line");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await screen.findByText(/Tell me what you would like to build/);
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("shows a Stop button while streaming and stops", async () => {
    installServer(new Map(), { chunkDelayMs: 30 });
    renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Message"), "write something long");
    await user.click(screen.getByRole("button", { name: /send/i }));
    const stop = await screen.findByRole("button", { name: /stop/i });
    await user.click(stop);
    await screen.findByRole("button", { name: /send/i });
  });

  it("renders model text as text, never as HTML", async () => {
    const { container } = render(
      <ChatPanel
        projectId="p"
        initialMessages={[
          {
            id: "1",
            role: "assistant",
            parts: [{ type: "text", text: '<img src=x onerror="alert(1)"><b>bold</b>' }],
          },
        ]}
        canUseAssistant
        hasCredits
        onFilesChanged={() => undefined}
        onFinished={() => undefined}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>bold</b>");
  });

  it("disables the composer when out of credits and explains why", () => {
    renderPanel({ hasCredits: false });
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByText(/out of credits/i)).toBeTruthy();
  });

  it("disables the composer until the email is confirmed", () => {
    renderPanel({ canUseAssistant: false });
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("shows the server's message when the request is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "daily_limit",
                message: "You have reached today's usage limit. Try again tomorrow.",
                requestId: "r",
              },
            }),
            { status: 429, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("today's usage limit");
  });

  it("will not send an empty or whitespace message", async () => {
    const { impl } = installServer(new Map());
    renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Message"), "   ");
    expect((screen.getByRole("button", { name: /send/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(impl).not.toHaveBeenCalled();
  });

  describe("prompt saved on the home page", () => {
    const PROJECT = "11111111-1111-4111-8111-111111111111";

    it("is sent once into its own project and then forgotten", async () => {
      savePendingPrompt("Build a coffee shop landing page", PROJECT);
      const { requests, impl } = installServer(new Map());
      renderPanel();
      await waitFor(() => expect(impl).toHaveBeenCalledTimes(1));
      const first = requests[0] as { message: { parts: Array<{ text: string }> } };
      expect(first.message.parts[0]?.text).toBe("Build a coffee shop landing page");
      expect(readPendingPrompt()).toBeNull();
    });

    it("is not sent into a different project", () => {
      savePendingPrompt("Build a coffee shop landing page", "22222222-2222-4222-8222-222222222222");
      const { impl } = installServer(new Map());
      renderPanel();
      expect(impl).not.toHaveBeenCalled();
      expect(readPendingPrompt()?.text).toBe("Build a coffee shop landing page");
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
    });

    it("waits in the composer when the assistant cannot run yet", () => {
      savePendingPrompt("Build a coffee shop landing page", PROJECT);
      const { impl } = installServer(new Map());
      renderPanel({ canUseAssistant: false });
      expect(impl).not.toHaveBeenCalled();
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
        "Build a coffee shop landing page",
      );
      expect(readPendingPrompt()).toBeNull();
    });
  });

  describe("readability and live feedback", () => {
    const assistant = (text: string) => [
      { id: "a", role: "assistant" as const, parts: [{ type: "text" as const, text }] },
    ];

    it("renders bold, code and lists the assistant writes instead of showing the markers", () => {
      const { container } = render(
        <ChatPanel
          projectId="p"
          initialMessages={assistant(
            "Added a **Contact** section in `App.tsx`.\n\n- phone\n- email",
          )}
          canUseAssistant
          hasCredits
          onFilesChanged={() => undefined}
          onFinished={() => undefined}
        />,
      );
      expect(container.querySelector("strong")?.textContent).toBe("Contact");
      expect(container.querySelector("code")?.textContent).toBe("App.tsx");
      expect(container.querySelectorAll("ul li")).toHaveLength(2);
      expect(container.textContent).not.toContain("**");
      expect(container.querySelector("a, img, script")).toBeNull();
    });

    it("does not animate history that was already there", () => {
      const { container } = render(
        <ChatPanel
          projectId="p"
          initialMessages={assistant("Hello")}
          canUseAssistant
          hasCredits
          onFilesChanged={() => undefined}
          onFinished={() => undefined}
        />,
      );
      expect(container.querySelector(".chat-in")).toBeNull();
    });

    it("shows a caret while text streams and removes it when the reply is done", async () => {
      installServer(new Map(), { chunkDelayMs: 40 });
      const { container } = render(
        <ChatPanel
          projectId="p"
          initialMessages={[]}
          canUseAssistant
          hasCredits
          onFilesChanged={() => undefined}
          onFinished={() => undefined}
        />,
      );
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("Message"), "Build a page");
      await user.click(screen.getByRole("button", { name: /send/i }));
      await waitFor(() => expect(container.querySelector(".stream-caret")).not.toBeNull());
      await screen.findByRole("button", { name: /send/i }, { timeout: 8000 });
      expect(container.querySelector(".stream-caret")).toBeNull();
      expect(container.querySelector(".thinking-dot")).toBeNull();
    });

    it("groups file steps into one list and fills the composer from a suggestion", async () => {
      installServer(new Map());
      renderPanel();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /landing page for a coffee shop/i }));
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toMatch(
        /coffee shop/i,
      );
      await user.click(screen.getByRole("button", { name: /send/i }));
      await screen.findByText("Created src/App.tsx");
      const lists = screen.getAllByRole("list", { name: "File changes" });
      expect(lists).toHaveLength(1);
      expect(lists[0]?.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
    });
  });
});
