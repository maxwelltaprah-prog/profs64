"use client";

import { ChevronRight, File, Folder } from "lucide-react";
import { useState } from "react";

import { iconProps } from "@/components/ui/icons";
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
            className={cn("transition-ui shrink-0", open && "rotate-90")}
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
        <File {...iconProps} className="shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}

export function FileTree({
  paths,
  selected,
  onSelect,
}: {
  paths: readonly string[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
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
