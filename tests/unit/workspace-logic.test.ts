import { describe, expect, it } from "vitest";

import { buildFileTree, clampSize } from "@/lib/workspace/file-tree";
import { filterActions, moveActive } from "@/lib/workspace/palette";

describe("buildFileTree", () => {
  it("nests paths, sorts folders before files, and is stable", () => {
    const tree = buildFileTree([
      "package.json",
      "src/main.tsx",
      "src/components/Hero.tsx",
      "index.html",
    ]);
    expect(tree.map((n) => `${n.kind}:${n.name}`)).toEqual([
      "folder:src",
      "file:index.html",
      "file:package.json",
    ]);
    const src = tree[0];
    expect(src?.children.map((n) => n.name)).toEqual(["components", "main.tsx"]);
    expect(src?.children[0]?.children[0]?.path).toBe("src/components/Hero.tsx");
  });

  it("returns an empty tree for no files", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("does not merge a file and a folder that share a name", () => {
    const tree = buildFileTree(["a", "a/b.ts"]);
    expect(tree).toHaveLength(2);
  });
});

describe("clampSize", () => {
  it("clamps and rejects non-finite values", () => {
    expect(clampSize(5, 22, 70)).toBe(22);
    expect(clampSize(99, 22, 70)).toBe(70);
    expect(clampSize(40, 22, 70)).toBe(40);
    expect(clampSize(Number.NaN, 22, 70)).toBe(22);
  });
});

describe("command palette logic", () => {
  const actions = [
    { id: "a", label: "Go to projects", keywords: "dashboard" },
    { id: "b", label: "Change theme", keywords: "dark light" },
    { id: "c", label: "Sign out", keywords: "logout" },
  ];

  it("returns everything for an empty query", () => {
    expect(filterActions(actions, "  ")).toHaveLength(3);
  });

  it("requires every term and searches keywords", () => {
    expect(filterActions(actions, "dark").map((a) => a.id)).toEqual(["b"]);
    expect(filterActions(actions, "go proj").map((a) => a.id)).toEqual(["a"]);
    expect(filterActions(actions, "zzz")).toEqual([]);
  });

  it("ranks label-prefix matches first", () => {
    expect(filterActions(actions, "s").map((a) => a.id)[0]).toBe("c");
  });

  it("wraps the active index", () => {
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, 1, 0)).toBe(0);
  });
});
