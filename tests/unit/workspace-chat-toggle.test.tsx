// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Workspace } from "@/components/workspace/workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/workspace/chat-panel", () => ({
  ChatPanel: ({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) => (
    <div>
      <p>chat body</p>
      <button type="button" onClick={() => onBusyChange?.(true)}>
        start work
      </button>
    </div>
  ),
}));
vi.mock("@/components/workspace/preview-panel", () => ({
  PreviewPanel: () => <p>preview body</p>,
}));

const paneHidden = (element: HTMLElement) => (element.closest("section") as HTMLElement).hidden;

const KEY = "buildr:chat-hidden:u1:p1";
const props = {
  userId: "u1",
  projectId: "p1",
  files: [],
  messages: [],
  outputs: {},
  balance: 10,
  canUseAssistant: true,
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("hide and show chat", () => {
  it("hides the chat without unmounting it, remembers the choice, and shows it again", async () => {
    const user = userEvent.setup();
    render(<Workspace {...props} />);
    const body = screen.getByText("chat body");
    await user.click(screen.getByRole("button", { name: "Hide chat" }));
    expect(screen.getByText("chat body")).toBe(body);
    expect(paneHidden(body)).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("1");

    await user.click(screen.getByRole("button", { name: "Show chat" }));
    expect(paneHidden(body)).toBe(false);
    expect(window.localStorage.getItem(KEY)).not.toBe("1");
  });

  it("starts hidden when it was hidden last time", () => {
    window.localStorage.setItem(KEY, "1");
    render(<Workspace {...props} />);
    expect(paneHidden(screen.getByText("chat body"))).toBe(true);
    expect(screen.getByRole("button", { name: "Show chat" })).toBeTruthy();
  });

  it("does not leak the choice to another project", () => {
    window.localStorage.setItem("buildr:chat-hidden:u1:other", "1");
    render(<Workspace {...props} />);
    expect(paneHidden(screen.getByText("chat body"))).toBe(false);
  });
});
