export interface TreeNode {
  name: string;
  /** Full path for files, folder path for folders. */
  path: string;
  kind: "file" | "folder";
  children: TreeNode[];
}

// Folders first, then files, each sorted by name, so the tree reads the same on every render.
export function buildFileTree(paths: readonly string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "folder", children: [] };
  for (const path of paths) {
    const segments = path.split("/");
    let current = root;
    segments.forEach((name, index) => {
      const isFile = index === segments.length - 1;
      const nodePath = segments.slice(0, index + 1).join("/");
      let child = current.children.find(
        (node) => node.path === nodePath && node.kind === (isFile ? "file" : "folder"),
      );
      if (!child) {
        child = { name, path: nodePath, kind: isFile ? "file" : "folder", children: [] };
        current.children.push(child);
      }
      current = child;
    });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1,
    );
    nodes.forEach((node) => sort(node.children));
  };
  sort(root.children);
  return root.children;
}

export function clampSize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
