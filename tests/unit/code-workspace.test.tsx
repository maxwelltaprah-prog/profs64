// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeWorkspace } from "@/components/workspace/code-workspace";

const files = [
  {
    path: "src/App.tsx",
    content:
      'import { useState } from "react";\nexport default function App() {\n  return <h1 className="x">Hi</h1>;\n}\n',
  },
  { path: "src/index.css", content: "body { color: red; }" },
  { path: "package.json", content: '{ "name": "my-app" }' },
  { path: "src/evil.tsx", content: '<img src=x onerror="alert(1)">' },
];

function Harness({ start = "src/App.tsx" }: { start?: string }) {
  const [selected, setSelected] = useState<string | null>(start);
  return (
    <CodeWorkspace projectName="My App" files={files} selected={selected} onSelect={setSelected} />
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CodeWorkspace", () => {
  it("highlights code with classes only: no inline styles, no HTML from file content", () => {
    const { container } = render(<Harness />);
    const region = screen.getByRole("region", { name: "Contents of src/App.tsx" });
    expect(region.querySelector(".tok-kw")?.textContent).toBe("import");
    expect(region.querySelector(".tok-str")?.textContent).toBe('"react"');
    expect(region.querySelectorAll(".tok-fn, .tok-tag").length).toBeGreaterThan(0);
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("shows markup in a file as text", async () => {
    const { container } = render(<Harness start="src/evil.tsx" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("region").textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("opens tabs as files are picked and closes them back to the neighbour", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("treeitem", { name: /index\.css/ }));
    const open = () =>
      [...screen.getByRole("list", { name: "Open files" }).querySelectorAll("li")].map(
        (item) => item.querySelector("button")?.textContent,
      );
    expect(open()).toEqual(["App.tsx", "index.css"]);
    expect(screen.getByRole("button", { name: "index.css" }).getAttribute("aria-current")).toBe(
      "page",
    );
    await user.click(screen.getByRole("button", { name: "Close index.css" }));
    expect(open()).toEqual(["App.tsx"]);
    expect(screen.getByRole("region", { name: "Contents of src/App.tsx" })).toBeTruthy();
  });

  it("filters files by name and opens a match", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "pack");
    const results = screen.getByRole("list", { name: "Matching files" });
    expect(results.textContent).toContain("package.json");
    expect(results.textContent).not.toContain("App.tsx");
    await user.click(screen.getByRole("button", { name: /package\.json/ }));
    expect(screen.getByRole("region", { name: "Contents of package.json" })).toBeTruthy();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No files match.")).toBeTruthy();
  });

  it("copies the open file and downloads the whole codebase as a zip", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const created: Blob[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return "blob:x";
      },
      revokeObjectURL: () => undefined,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(files[0]?.content);
    expect(await screen.findByText("Copied")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Download codebase" }));
    expect(click).toHaveBeenCalled();
    const zip = created.at(-1);
    expect(zip?.type).toBe("application/zip");
    if (!zip) throw new Error("no zip was created");
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50);
    click.mockRestore();
  });
});
