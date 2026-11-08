// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
  // Only the chat request is counted by `impl`; the panel's other calls (credits and ratings for
  // each reply, attachments, feedback) are answered by `side`, so tests can see them separately.
  // The init parameter is unused here but types the recorded calls that tests inspect.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const side = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith("/outputs")) return Response.json({ outputs: {} });
    if (url.endsWith("/files")) return Response.json({ paths: [] }, { status: 201 });
    return Response.json({ rating: null });
  });
  vi.stubGlobal("fetch", (url: unknown, init?: RequestInit) =>
    String(url).includes("/api/chat") ? impl(url, init) : side(String(url), init),
  );
  return { requests, impl, side };
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

    // The finished reply is a preview: the closing message and one line on what changed.
    await screen.findByText(/Done\. I updated the project files\./);
    await screen.findByText(/Created 2 files/);
    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    // Details opens the individual steps.
    await user.click(screen.getByRole("button", { name: /details/i }));
    await screen.findByText("Created src/components/Hero.tsx");
    await screen.findByText("Created src/App.tsx");
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
      expect(container.querySelectorAll('[role="log"] ul:not([aria-label]) li')).toHaveLength(2);
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
      expect(container.querySelector('[role="log"] .chat-in')).toBeNull();
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

    it("fills the composer from a starting point, then groups the steps behind Details", async () => {
      installServer(new Map());
      renderPanel();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /landing page for a coffee shop/i }));
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toMatch(
        /coffee shop/i,
      );
      await user.click(screen.getByRole("button", { name: /send/i }));
      await screen.findByText(/Created 2 files/);
      await user.click(screen.getByRole("button", { name: /details/i }));
      const lists = await screen.findAllByRole("list", { name: "File changes" });
      expect(lists).toHaveLength(1);
      expect(lists[0]?.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("actions on each output", () => {
    const THREAD = "11111111-1111-4111-8111-111111111111";
    const reply = (id = "22222222-2222-4222-8222-222222222222") => [
      { id: "u1", role: "user" as const, parts: [{ type: "text" as const, text: "Build it" }] },
      {
        id,
        role: "assistant" as const,
        parts: [
          { type: "text" as const, text: "Let me look first." },
          {
            type: "tool-write_file" as const,
            toolCallId: "t1",
            state: "output-available" as const,
            input: { path: "src/App.tsx", content: "x" },
            output: { ok: true, path: "src/App.tsx", action: "updated" },
          },
          { type: "text" as const, text: "Updated the app with a **new** hero." },
        ],
      },
    ];
    const setup = (extra: Partial<Parameters<typeof ChatPanel>[0]> = {}) => {
      const server = installServer(new Map());
      render(
        <ChatPanel
          projectId={THREAD}
          initialMessages={reply() as never}
          initialOutputs={{
            "22222222-2222-4222-8222-222222222222": {
              usage: { credits: 0.81, inputTokens: 12735, outputTokens: 1441 },
              rating: null,
            },
          }}
          canUseAssistant
          hasCredits
          onFilesChanged={() => undefined}
          onFinished={() => undefined}
          {...extra}
        />,
      );
      return server;
    };

    it("shows the closing message as a preview, the credits used, and opens details on request", async () => {
      const onOpenFile = vi.fn();
      const onOpenPreview = vi.fn();
      setup({ onOpenFile, onOpenPreview });
      const user = userEvent.setup();
      expect(screen.getByText("0.81 credits")).toBeTruthy();
      expect(screen.getByText(/Updated 1 file/)).toBeTruthy();
      // Earlier narration and the individual steps stay folded away.
      expect(screen.queryByText("Let me look first.")).toBeNull();
      expect(screen.queryByText("Updated src/App.tsx")).toBeNull();

      await user.click(screen.getByRole("button", { name: /details/i }));
      expect(screen.getByText("Let me look first.")).toBeTruthy();
      expect(screen.getByText("Updated src/App.tsx")).toBeTruthy();
      expect(screen.getByText(/12,735 tokens in/)).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "src/App.tsx" }));
      expect(onOpenFile).toHaveBeenCalledWith("src/App.tsx");
      await user.click(screen.getByRole("button", { name: /view preview/i }));
      expect(onOpenPreview).toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: /details/i }));
      expect(screen.queryByText("Let me look first.")).toBeNull();
    });

    it("copies the reply text", async () => {
      setup();
      const user = userEvent.setup();
      // After setup(): user-event installs its own clipboard stub, which this replaces.
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      await user.click(screen.getByRole("button", { name: "Copy reply" }));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0]?.[0]).toContain("Updated the app with a **new** hero.");
      await screen.findByText("Copied");
    });

    it("shares through the device when it can, and copies when it cannot", async () => {
      setup();
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", { value: share, configurable: true });
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Share reply" }));
      expect(share).toHaveBeenCalledWith({ text: expect.stringContaining("new") });
      await screen.findByText("Shared");

      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      await user.click(screen.getByRole("button", { name: "Share reply" }));
      expect(writeText).toHaveBeenCalled();
    });

    it("records a rating, toggles it off, and rolls back when saving fails", async () => {
      const { side } = setup();
      const user = userEvent.setup();
      const up = screen.getByRole("button", { name: "Good reply" });
      await user.click(up);
      expect(up.getAttribute("aria-pressed")).toBe("true");
      const call = side.mock.calls.find(([url]) => url.endsWith("/feedback"));
      expect(call?.[0]).toBe(
        `/api/projects/${THREAD}/messages/22222222-2222-4222-8222-222222222222/feedback`,
      );
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ rating: "up" });

      await user.click(up);
      expect(up.getAttribute("aria-pressed")).toBe("false");
      const last = side.mock.calls.filter(([url]) => url.endsWith("/feedback")).at(-1);
      expect(JSON.parse(String(last?.[1]?.body))).toEqual({ rating: "none" });

      side.mockImplementation(async () => new Response("{}", { status: 500 }));
      await user.click(screen.getByRole("button", { name: "Bad reply" }));
      await screen.findByText(/rating could not be saved/i);
      expect(screen.getByRole("button", { name: "Bad reply" }).getAttribute("aria-pressed")).toBe(
        "false",
      );
    });

    it("offers follow-up ideas after a reply, and a click fills the composer", async () => {
      setup({ projectFiles: [{ path: "src/App.tsx", content: "export default 1" }] });
      const user = userEvent.setup();
      const list = screen.getByRole("list", { name: "Suggested next steps" });
      const first = list.querySelector("button") as HTMLButtonElement;
      await user.click(first);
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
        first.textContent,
      );
      // Once there is text in the box the ideas step aside.
      expect(screen.queryByRole("list", { name: "Suggested next steps" })).toBeNull();
    });
  });

  describe("attachments", () => {
    const THREAD = "11111111-1111-4111-8111-111111111111";
    const pick = async (files: File[]) => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      // The picker's accept list is a convenience; the checks must hold for any file that gets in.
      await userEvent.setup({ applyAccept: false }).upload(input, files);
    };

    it("uploads text files as project files and sends the message with their names", async () => {
      const { side, requests } = installServer(new Map());
      side.mockImplementation(async (url) =>
        url.endsWith("/files")
          ? Response.json({ paths: ["attachments/menu.md"] }, { status: 201 })
          : Response.json({ outputs: {} }),
      );
      renderPanel();
      const user = userEvent.setup();
      await pick([new File(["# Menu\n- Espresso"], "menu.md", { type: "text/markdown" })]);
      expect(await screen.findByText("menu.md")).toBeTruthy();
      await user.type(screen.getByLabelText("Message"), "Use my menu");
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => expect(requests).toHaveLength(1));
      const upload = side.mock.calls.find(([url]) => url.endsWith("/files"));
      expect(upload?.[0]).toBe(`/api/projects/${THREAD}/files`);
      expect(JSON.parse(String(upload?.[1]?.body))).toEqual({
        files: [{ name: "menu.md", content: "# Menu\n- Espresso" }],
      });
      const sent = requests[0] as { message: { parts: Array<{ text: string }> } };
      expect(sent.message.parts[0]?.text).toBe("Use my menu\n\nAttached: attachments/menu.md");
      // The bubble shows the file as a chip, not the marker line.
      await screen.findByLabelText("Attached files");
      expect(screen.queryByText(/Attached: attachments/)).toBeNull();
    });

    it("rejects binary, oversized and surplus files with a plain reason", async () => {
      installServer(new Map());
      renderPanel();
      await pick([new File([new Uint8Array([80, 75, 3, 4, 0, 0])], "bundle.zip")]);
      expect((await screen.findByRole("alert")).textContent).toMatch(/only text files/i);

      await pick([new File(["x".repeat(101 * 1024)], "big.txt")]);
      await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/under 100 KB/));

      await pick(["a", "b", "c", "d"].map((name) => new File([`content ${name}`], `${name}.md`)));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/up to 3 files/));
      expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
    });

    it("keeps the message and files when the upload fails", async () => {
      const { side, impl } = installServer(new Map());
      side.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              error: { message: "This project has reached the limit of 100 files." },
            }),
            {
              status: 409,
              headers: { "content-type": "application/json" },
            },
          ),
      );
      renderPanel();
      const user = userEvent.setup();
      await pick([new File(["hello"], "a.md")]);
      await user.type(screen.getByLabelText("Message"), "Use it");
      await user.click(screen.getByRole("button", { name: /send/i }));
      expect((await screen.findByRole("alert")).textContent).toMatch(/limit of 100 files/);
      expect(impl).not.toHaveBeenCalled();
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("Use it");
      expect(screen.getByText("a.md")).toBeTruthy();
    });

    it("lets a file be removed before sending", async () => {
      installServer(new Map());
      renderPanel();
      await pick([new File(["hello"], "a.md")]);
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Remove a.md" }));
      expect(screen.queryByText("a.md")).toBeNull();
    });
  });

  describe("voice input", () => {
    class FakeRecognition {
      static last: FakeRecognition | null = null;
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      started = false;
      constructor() {
        FakeRecognition.last = this;
      }
      start() {
        this.started = true;
      }
      stop() {
        this.started = false;
        this.onend?.();
      }
      abort() {
        this.stop();
      }
      say(text: string) {
        const items = [{ isFinal: true, length: 1, 0: { transcript: text } }];
        this.onresult?.({
          resultIndex: 0,
          results: { length: 1, item: (index: number) => items[index] },
        });
      }
    }
    const original = (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
    afterEach(() => {
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
        original;
      FakeRecognition.last = null;
    });

    it("is hidden when the browser has no speech recognition", () => {
      installServer(new Map());
      renderPanel();
      expect(screen.queryByRole("button", { name: /voice input/i })).toBeNull();
    });

    it("dictates into the box, keeps what was typed, and stops on a second press", async () => {
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
        FakeRecognition;
      installServer(new Map());
      renderPanel();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("Message"), "Make it");
      const mic = await screen.findByRole("button", { name: "Start voice input" });
      await user.click(mic);
      expect(FakeRecognition.last?.started).toBe(true);
      expect(FakeRecognition.last?.continuous).toBe(true);
      expect(screen.getByRole("button", { name: "Stop voice input" })).toBeTruthy();
      expect(screen.getByText(/browser turns speech into text/i)).toBeTruthy();

      act(() => FakeRecognition.last?.say("warmer and friendlier"));
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
        "Make it warmer and friendlier",
      );
      await user.click(screen.getByRole("button", { name: "Stop voice input" }));
      expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
    });

    it("explains a blocked microphone", async () => {
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
        FakeRecognition;
      installServer(new Map());
      renderPanel();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Start voice input" }));
      act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));
      expect(await screen.findByText(/microphone access is blocked/i)).toBeTruthy();
    });
  });
});
