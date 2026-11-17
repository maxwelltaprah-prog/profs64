// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GitHubPanel } from "@/components/workspace/github-panel";
import { ProjectSettings } from "@/components/workspace/project-settings";

const router = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  router.push.mockReset();
  router.refresh.mockReset();
});

const TOKEN = "github_pat_" + "A".repeat(30);

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Repository"), "ada/site");
  await user.type(screen.getByLabelText("Access token"), TOKEN);
}

describe("GitHubPanel", () => {
  it("does not allow a push until something is built", () => {
    render(<GitHubPanel projectId="p1" built={false} />);
    expect(screen.getByText(/Nothing is built yet/)).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Push to GitHub" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("pushes, shows the commit link, clears the token and remembers only the repository", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            repoUrl: "https://github.com/ada/site",
            branch: "main",
            commitUrl: "https://github.com/ada/site/commit/abc",
            createdRepo: false,
            unchanged: false,
            fileCount: 7,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<GitHubPanel projectId="p1" built />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Push to GitHub" }));

    await screen.findByText(/Pushed 7 files to main/);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/projects/p1/github");
    expect(JSON.parse(String(init.body))).toEqual({
      token: TOKEN,
      repo: "ada/site",
      create: false,
    });
    expect((screen.getByLabelText("Access token") as HTMLInputElement).value).toBe("");
    const stored = window.localStorage.getItem("buildr:github:p1") ?? "";
    expect(stored).toContain("ada/site");
    expect(stored).not.toContain(TOKEN);
    expect(screen.getByRole("link", { name: /Open on GitHub/ }).getAttribute("href")).toBe(
      "https://github.com/ada/site/commit/abc",
    );
  });

  it("shows the server's message when GitHub refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: "GitHub did not accept that token." } }),
            {
              status: 401,
            },
          ),
      ),
    );
    render(<GitHubPanel projectId="p1" built />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Push to GitHub" }));
    expect((await screen.findByRole("alert")).textContent).toContain("did not accept that token");
    expect((screen.getByLabelText("Access token") as HTMLInputElement).value).toBe(TOKEN);
  });
});

describe("ProjectSettings", () => {
  const props = {
    open: true,
    section: "details" as const,
    onSectionChange: vi.fn(),
    onClose: vi.fn(),
    projectId: "p1",
    name: "Bean There",
    createdAt: "2026-11-10T05:04:00Z",
    ownerEmail: "me@example.com",
    built: false,
    shareSlug: null,
    shareAvailable: true,
  };

  it("shows real details and a launch path that says nothing is built or shared yet", () => {
    render(<ProjectSettings {...props} />);
    expect(screen.getByDisplayValue("Bean There")).toBeDefined();
    expect(screen.getByText("me@example.com")).toBeDefined();
    expect(screen.getByText("Nov 10, 2026")).toBeDefined();
    expect(screen.getByText("Not started")).toBeDefined();
    expect(screen.getByText("Private")).toBeDefined();
    expect(screen.getByText("Not pushed")).toBeDefined();
    expect(screen.getByText("Guide")).toBeDefined();
  });

  it("renames through the API and refreshes", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProjectSettings {...props} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Project name");
    await user.clear(input);
    await user.type(input, "Bean There Cafe");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Bean There Cafe" });
  });

  it("needs a second click to delete, then leaves for the dashboard", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProjectSettings {...props} section="danger" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete this project" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe("DELETE");
  });
});
