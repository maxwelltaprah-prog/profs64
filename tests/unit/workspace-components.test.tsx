// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { CommandPalette } from "@/components/command-palette";
import { CodeViewer } from "@/components/workspace/code-viewer";
import { FileTree } from "@/components/workspace/file-tree";
import { SplitPane } from "@/components/workspace/split-pane";

beforeAll(() => {
  // jsdom does not implement <dialog> modal methods.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("SplitPane", () => {
  const setup = () =>
    render(
      <SplitPane
        storageKey="k"
        firstLabel="Chat"
        first={<p>one</p>}
        second={<p>two</p>}
        defaultSize={36}
      />,
    );

  it("exposes an accessible separator that moves with the keyboard and persists", () => {
    setup();
    const separator = screen.getByRole("separator");
    expect(separator.getAttribute("aria-valuenow")).toBe("36");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator.getAttribute("aria-valuenow")).toBe("38");
    expect(window.localStorage.getItem("k")).toBe("38");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator.getAttribute("aria-valuenow")).toBe("22");
    fireEvent.keyDown(separator, { key: "End" });
    expect(separator.getAttribute("aria-valuenow")).toBe("70");
  });

  it("restores a stored size and ignores a corrupt one", () => {
    window.localStorage.setItem("k", "50");
    setup();
    expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("50");
    cleanup();
    window.localStorage.setItem("k", "not-a-number");
    setup();
    expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("36");
  });

  it("server markup has no inline style attribute (the size is set later through the CSSOM)", () => {
    const html = renderToStaticMarkup(
      <SplitPane storageKey="k" firstLabel="Chat" first={<p>one</p>} second={<p>two</p>} />,
    );
    expect(html).not.toContain("style=");
  });
});

describe("SplitPane hidden first pane", () => {
  it("keeps the first pane mounted but hidden, and hides the separator", () => {
    const { rerender } = render(
      <SplitPane storageKey="k" firstLabel="Chat" first={<p>one</p>} second={<p>two</p>} />,
    );
    const first = screen.getByText("one");
    expect(first.closest("section")?.hidden).toBe(false);
    rerender(
      <SplitPane
        storageKey="k"
        firstLabel="Chat"
        first={<p>one</p>}
        second={<p>two</p>}
        firstHidden
      />,
    );
    // Same node: the pane was not unmounted, so a streaming reply inside it keeps running.
    expect(screen.getByText("one", { selector: "p" })).toBe(first);
    expect(first.closest("section")?.hidden).toBe(true);
    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.getByText("two").closest("section")).toBeNull();
  });
});

describe("FileTree", () => {
  it("selects files, collapses folders and shows an empty state", async () => {
    const picked: string[] = [];
    const user = userEvent.setup();
    const { rerender } = render(
      <FileTree
        paths={["src/main.tsx", "index.html"]}
        selected={null}
        onSelect={(p) => picked.push(p)}
      />,
    );
    await user.click(screen.getByRole("treeitem", { name: "main.tsx" }));
    expect(picked).toEqual(["src/main.tsx"]);
    await user.click(screen.getByRole("treeitem", { name: "src" }));
    expect(screen.queryByRole("treeitem", { name: "main.tsx" })).toBeNull();
    rerender(<FileTree paths={[]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText(/No files yet/)).toBeTruthy();
  });
});

describe("CodeViewer", () => {
  it("renders file content as text, never as HTML", () => {
    const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const { container } = render(<CodeViewer path="a.html" content={hostile} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain(hostile);
  });

  it("shows a prompt when nothing is selected", () => {
    render(<CodeViewer path={null} content={null} />);
    expect(screen.getByText("Select a file to view it.")).toBeTruthy();
  });
});

describe("CommandPalette", () => {
  it("opens with Ctrl+K, filters, runs the active action with Enter and closes", async () => {
    const ran: string[] = [];
    const user = userEvent.setup();
    render(
      <CommandPalette
        actions={[
          { id: "a", label: "Go to projects", run: () => ran.push("a") },
          { id: "b", label: "Sign out", run: () => ran.push("b") },
        ]}
      />,
    );
    await user.keyboard("{Control>}k{/Control}");
    const input = screen.getByRole("combobox", { name: "Search commands" });
    await user.type(input, "sign");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(ran).toEqual(["b"]);
  });

  it("explains an empty result", async () => {
    const user = userEvent.setup();
    render(<CommandPalette actions={[{ id: "a", label: "Go", run: () => {} }]} />);
    await user.keyboard("{Control>}k{/Control}");
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText(/No command matches/)).toBeTruthy();
  });
});
