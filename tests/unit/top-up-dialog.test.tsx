// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TopUpButton } from "@/components/billing/top-up-dialog";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

describe("TopUpButton", () => {
  it("opens the packs, is honest that nothing is charged, and records interest", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetcher);
    render(<TopUpButton />);
    await userEvent.click(screen.getByRole("button", { name: "Top up credits" }));
    expect(screen.getByText(/nothing is charged/i)).toBeDefined();
    await userEvent.click(screen.getAllByRole("button", { name: "Notify me" })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText("On the list")).toBeDefined());
    expect(fetcher).toHaveBeenCalledWith(
      "/api/billing/waitlist",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ pack: "starter" }) }),
    );
  });
  it("shows an error when saving fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    render(<TopUpButton />);
    await userEvent.click(screen.getByRole("button", { name: "Top up credits" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Notify me" })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });
});
