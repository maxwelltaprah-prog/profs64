// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreviewPanel } from "@/components/workspace/preview-panel";
import { STARTER_FILES } from "@/lib/templates/vite-react-starter";

const files = STARTER_FILES.map((file, index) => ({
  id: `f${index}`,
  path: file.path,
  content: file.content,
  updatedAt: "2026-01-01T00:00:00Z",
}));

afterEach(() => cleanup());

async function renderPanel(input = files) {
  render(<PreviewPanel files={input} />);
  // The transpiler loads lazily and the build is debounced.
  await waitFor(() => expect(screen.queryByTitle("Project preview")).not.toBeNull(), {
    timeout: 5000,
  });
}

function frameWindow(): Window {
  const iframe = screen.getByTitle("Project preview") as HTMLIFrameElement;
  return iframe.contentWindow as Window;
}

describe("PreviewPanel", () => {
  it("builds the project, loads the sandboxed frame and hands it the bundle when ready", async () => {
    await renderPanel();
    const iframe = screen.getByTitle("Project preview") as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-modals");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe.getAttribute("src")).toMatch(/^\/preview-frame\?v=\d+$/);
    expect(screen.getByText("Loading")).toBeDefined();

    const posted = vi.spyOn(frameWindow(), "postMessage");
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "ready" }, source: frameWindow() }),
      );
    });
    expect(posted).toHaveBeenCalledTimes(1);
    const [message] = posted.mock.calls[0] as [{ type: string; bundle: { entry: string } }];
    expect(message.type).toBe("render");
    expect(message.bundle.entry).toBe("~/src/main.tsx");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "rendered" }, source: frameWindow() }),
      );
    });
    expect(screen.getByText("Live")).toBeDefined();
  });

  it("ignores messages that do not come from its own frame", async () => {
    await renderPanel();
    const posted = vi.spyOn(frameWindow(), "postMessage");
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { type: "ready" }, source: null }));
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "rendered" }, source: null }),
      );
    });
    expect(posted).not.toHaveBeenCalled();
    expect(screen.getByText("Loading")).toBeDefined();
  });

  it("shows compile problems instead of loading a frame", async () => {
    const broken = files.map((file) =>
      file.path === "src/App.tsx"
        ? { ...file, content: 'import X from "./nowhere";\nexport default X;' }
        : file,
    );
    render(<PreviewPanel files={broken} />);
    await screen.findByText("The preview could not run", undefined, { timeout: 5000 });
    expect(screen.getByText(/Cannot find \.\/nowhere/)).toBeDefined();
    expect(screen.queryByTitle("Project preview")).toBeNull();
  });

  it("switches preview widths", async () => {
    await renderPanel();
    expect(screen.getByRole("group", { name: "Preview width" })).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(screen.getByRole("button", { name: "Phone" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Desktop" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});
