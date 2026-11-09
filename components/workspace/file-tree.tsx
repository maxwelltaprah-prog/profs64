"use client";

import { ChevronRight, Folder } from "lucide-react";
import { useState } from "react";

import { iconProps } from "@/components/ui/icons";
import { FileTypeIcon } from "@/components/workspace/file-icon";
import { cn } from "@/lib/utils/cn";
import { buildFileTree, type TreeNode } from "@/lib/workspace/file-tree";

function Node({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  // Indentation comes from a fixed set of classes because inline styles are blocked by the CSP.
  const indent = ["pl-2", "pl-5", "pl-8", "pl-11", "pl-14", "pl-17", "pl-20", "pl-23"][
    Math.min(depth, 7)
  ];

  if (node.kind === "folder") {
    return (
      <li role="none">
        <button
          type="button"
          role="treeitem"
          aria-expanded={open}
          aria-selected={false}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "transition-ui text-muted hover:bg-surface-2 flex w-full items-center gap-1.5 py-1 pr-2 text-left text-[13px]",
            indent,
          )}
        >
          <ChevronRight
            {...iconProps}
            className={cn(
              "shrink-0 transition-transform duration-200 ease-out",
              open && "rotate-90",
            )}
          />
          <Folder {...iconProps} className="shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {open ? (
          <ul role="group">
            {node.children.map((child) => (
              <Node
                key={`${child.kind}:${child.path}`}
                node={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-selected={selected === node.path}
        onClick={() => onSelect(node.path)}
        className={cn(
          "transition-ui hover:bg-surface-2 flex w-full items-center gap-1.5 py-1 pr-2 text-left text-[13px]",
          indent,
          selected === node.path ? "bg-surface-2 text-text" : "text-muted",
        )}
      >
        <span className="size-4 shrink-0" aria-hidden="true" />
        <FileTypeIcon path={node.path} />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}

export function FileTree({
  paths,
  selected,
  onSelect,
  query = "",
}: {
  paths: readonly string[];
  selected: string | null;
  onSelect: (path: string) => void;
  /** When set, a flat list of the files whose path contains it replaces the tree. */
  query?: string;
}) {
  const needle = query.trim().toLowerCase();
  if (needle) {
    const matches = paths.filter((path) => path.toLowerCase().includes(needle));
    if (matches.length === 0) {
      return <p className="text-muted p-3 text-[13px]">No files match.</p>;
    }
    return (
      <ul aria-label="Matching files" className="py-1">
        {matches.map((path) => (
          <li key={path}>
            <button
              type="button"
              aria-current={selected === path ? "true" : undefined}
              onClick={() => onSelect(path)}
              className={cn(
                "transition-ui hover:bg-surface-2 flex w-full flex-col items-start py-1.5 pr-2 pl-3 text-left",
                selected === path ? "bg-surface-2 text-text" : "text-muted",
              )}
            >
              <span className="flex items-center gap-1.5 text-[13px]">
                <FileTypeIcon path={path} />
                <span className="truncate">{path.split("/").pop()}</span>
              </span>
              <span className="text-subtle truncate pl-5 font-mono text-[11px]">{path}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  const tree = buildFileTree(paths);
  if (tree.length === 0) {
    return (
      <p className="text-muted p-3 text-[13px]">
        No files yet. Ask the assistant to build something.
      </p>
    );
  }
  return (
    <ul role="tree" aria-label="Project files" className="py-1">
      {tree.map((node) => (
        <Node
          key={`${node.kind}:${node.path}`}
          node={node}
          depth={0}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
