// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PromptBox } from "@/components/landing/prompt-box";
import { StartProject } from "@/components/start/start-project";
import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";
import {
  clearPendingPrompt,
  PENDING_PROMPT_KEY,
  projectNameFromPrompt,
  readPendingPrompt,
  savePendingPrompt,
} from "@/lib/workspace/pending-prompt";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pending prompt storage", () => {
  it("round-trips trimmed text and drops empty or stale entries", () => {
    expect(savePendingPrompt("   ")).toBeNull();
    expect(readPendingPrompt()).toBeNull();

    savePendingPrompt("  Build a shop\r\nwith a menu  ");
    expect(readPendingPrompt()?.text).toBe("Build a shop\nwith a menu");

    const stale = readPendingPrompt();
    expect(readPendingPrompt((stale?.savedAt ?? 0) + 25 * 60 * 60 * 1000)).toBeNull();
    expect(window.localStorage.getItem(PENDING_PROMPT_KEY)).toBeNull();
  });

  it("caps the text at the chat limit and keeps the project id", () => {
    savePendingPrompt("x".repeat(CHAT_TEXT_MAX_CHARS + 50), "p1");
    const entry = readPendingPrompt();
    expect(entry?.text.length).toBe(CHAT_TEXT_MAX_CHARS);
    expect(entry?.projectId).toBe("p1");
  });

  it("ignores tampered storage instead of throwing", () => {
    window.localStorage.setItem(PENDING_PROMPT_KEY, "{not json");
    expect(readPendingPrompt()).toBeNull();
    window.localStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify({ text: 5, savedAt: "x" }));
    expect(readPendingPrompt()).toBeNull();
    clearPendingPrompt();
  });

  it("derives a clean project name from the first line", () => {
    expect(projectNameFromPrompt("\n\n  A coffee\tshop\u0007 site \nmore")).toBe(
      "A coffee shop site",
    );
    expect(projectNameFromPrompt("")).toBe("New project");
    const long = projectNameFromPrompt(
      "A very long description of an application that goes on and on past the limit",
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith(" ")).toBe(false);
    expect(long).toBe("A very long description of an application that goes on and");
    expect(
      projectNameFromPrompt(
        "Build a landing page for a coffee shop called Bean There: a Hero with the name",
      ),
    ).toBe("Build a landing page for a coffee shop called Bean There");
    expect(
      projectNameFromPrompt("Make me a todo app, with dark mode and a weekly view please and more"),
    ).toBe("Make me a todo app, with dark mode and a weekly view please");
  });
});

describe("PromptBox", () => {
  it("asks for a description before doing anything", async () => {
    render(<PromptBox signedIn={false} passwordMin={12} />);
    await userEvent.click(screen.getByRole("button", { name: /generate/i }));
    expect(screen.getByRole("alert").textContent).toBe("Describe the app you want to build.");
    expect(readPendingPrompt()).toBeNull();
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(false);
  });

  it("saves the prompt and opens the account dialog when signed out", async () => {
    render(<PromptBox signedIn={false} passwordMin={12} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/describe the app/i), "A coffee shop site");
    await user.click(screen.getByRole("button", { name: "Generate for free" }));

    expect(readPendingPrompt()?.text).toBe("A coffee shop site");
    expect(router.push).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByRole("tab", { name: "Create account", selected: true })).toBeDefined();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDefined();

    await user.click(screen.getByRole("tab", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  });

  it("sends the signup with the start path so the email link lands there", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: "check_email" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PromptBox signedIn={false} passwordMin={12} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/describe the app/i), "A coffee shop site");
    await user.click(screen.getByRole("button", { name: "Generate for free" }));
    await user.type(screen.getByLabelText("Email"), "person@example.org");
    await user.type(screen.getByLabelText("Password"), "a-long-enough-passphrase");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/signup");
    expect(JSON.parse(String(init.body))).toEqual({
      next: "/start",
      email: "person@example.org",
      password: "a-long-enough-passphrase",
    });
    await screen.findByText("Check your email");
  });

  it("goes straight to /start when already signed in", async () => {
    render(<PromptBox signedIn={true} passwordMin={12} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/describe the app/i), "A habit tracker");
    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(readPendingPrompt()?.text).toBe("A habit tracker");
    expect(router.push).toHaveBeenCalledWith("/start");
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(false);
  });
});

describe("StartProject", () => {
  it("creates a project named from the prompt and opens it", async () => {
    savePendingPrompt("A coffee shop site\nwith a menu");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ project: { id: "p-new" } }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<StartProject />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/project/p-new"));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ name: "A coffee shop site" });
    expect(readPendingPrompt()).toMatchObject({
      text: "A coffee shop site\nwith a menu",
      projectId: "p-new",
    });
  });

  it("goes to the dashboard when there is nothing pending", async () => {
    render(<StartProject />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("reopens an already-created project without creating another", async () => {
    savePendingPrompt("Anything", "p-old");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<StartProject />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/project/p-old"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message and keeps the prompt when creation fails", async () => {
    savePendingPrompt("Anything");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Too many projects today." } }), {
          status: 429,
        }),
      ),
    );
    render(<StartProject />);
    await screen.findByText("Too many projects today.");
    expect(readPendingPrompt()?.text).toBe("Anything");
    expect(router.replace).not.toHaveBeenCalled();
  });
});
