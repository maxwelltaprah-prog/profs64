// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/app-header";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const renderHeader = () =>
  render(
    <ToastProvider>
      <AppHeader balance={12} theme="system" />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset["leaving"];
});

describe("sign out", () => {
  it("answers the click at once, then leaves with a full navigation", async () => {
    let finish: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))),
    );
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    renderHeader();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    // Before the server has answered: busy button and dimmed page.
    const busy = screen.getByRole("button", { name: "Signing out" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(document.documentElement.dataset["leaving"]).toBe("true");
    expect(replace).not.toHaveBeenCalled();

    finish(Response.json({ status: "ok" }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("restores the page and says so when signing out fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    renderHeader();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText(/Could not sign out/);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(document.documentElement.dataset["leaving"]).toBeUndefined();
    expect(replace).not.toHaveBeenCalled();
  });
});
