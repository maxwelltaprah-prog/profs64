// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Workspace } from "@/components/workspace/workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/components/workspace/chat-panel", () => ({
  ChatPanel: () => <div>Conversation panel</div>,
}));
vi.mock("@/components/workspace/code-workspace", () => ({
  CodeWorkspace: () => <div>Code workspace</div>,
}));
vi.mock("@/components/workspace/preview-panel", () => ({
  PreviewPanel: () => <div>Project preview</div>,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("workspace view controls", () => {
  it("switches between code and preview with accessible segmented tabs", async () => {
    render(
      <Workspace
        userId="user-1"
        projectId="project-1"
        projectName="Coffee shop"
        files={[]}
        messages={[]}
        outputs={{}}
        balance={20}
        canUseAssistant
      />,
    );

    expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Project preview")).toBeDefined();

    await userEvent.click(screen.getByRole("tab", { name: "Code" }));

    expect(screen.getByRole("tab", { name: "Code" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Code workspace")).toBeDefined();
  });
});
