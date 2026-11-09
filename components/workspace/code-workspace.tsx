"use client";

import { Check, Copy, Download, FolderDown, Search, X } from "lucide-react";
import { Highlight, Prism } from "prism-react-renderer";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { FileTypeIcon } from "@/components/workspace/file-icon";
import { FileTree } from "@/components/workspace/file-tree";
import { type ProjectFile } from "@/lib/db/projects";
import { cn } from "@/lib/utils/cn";
import { languageFor, tokenClass } from "@/lib/workspace/code-language";
import { createZip, zipFolderName } from "@/lib/workspace/zip";

// No theme: Prism would return inline style objects, which the CSP blocks. Colours come from the
// tok-* classes instead (globals.css), designed for both themes.
const NO_THEME = { plain: {}, styles: [] };
const MAX_TABS = 8;

function save(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseName(path: string) {
  return path.split("/").pop() ?? path;
}

// Read-only. Code is rendered as React text nodes inside spans, never as HTML.
function HighlightedCode({ path, content }: { path: string; content: string }) {
  return (
    <Highlight prism={Prism} theme={NO_THEME} code={content} language={languageFor(path)}>
      {({ tokens }) => (
        <pre className="code-view min-w-max py-3 font-mono text-[13px] leading-[1.6]">
          {tokens.map((line, index) => (
            <div key={index} className="hover:bg-surface-2/60 flex">
              <span
                aria-hidden="true"
                className="text-subtle w-12 shrink-0 pr-4 text-right tabular-nums select-none"
              >
                {index + 1}
              </span>
              <code className="pr-6 whitespace-pre">
                {line.length === 0 || (line.length === 1 && line[0]?.content === "")
                  ? " "
                  : line.map((token, key) => (
                      <span key={key} className={tokenClass(token.types)}>
                        {token.content}
                      </span>
                    ))}
              </code>
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

export function CodeWorkspace({
  projectName,
  files,
  selected,
  onSelect,
}: {
  projectName: string;
  files: readonly ProjectFile[];
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  const [tabs, setTabs] = useState<string[]>(selected ? [selected] : []);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const byPath = useMemo(() => new Map(files.map((file) => [file.path, file.content])), [files]);

  // Whatever is selected (from the tree, a chat link or a new file) gets a tab; tabs for files
  // that no longer exist close themselves.
  useEffect(() => {
    // Keeping tabs in step with a selection made elsewhere is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTabs((current) => {
      const alive = current.filter((path) => byPath.has(path));
      if (!selected || alive.includes(selected)) return alive;
      return [...alive, selected].slice(-MAX_TABS);
    });
  }, [selected, byPath]);

  const close = (path: string) => {
    const index = tabs.indexOf(path);
    const next = tabs.filter((tab) => tab !== path);
    setTabs(next);
    if (path === selected) onSelect(next.at(Math.max(0, index - 1)) ?? null);
  };

  const content = selected ? byPath.get(selected) : undefined;

  const copy = async () => {
    if (content === undefined) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is still selectable.
    }
  };

  const downloadAll = () => {
    const folder = zipFolderName(projectName);
    save(`${folder}.zip`, createZip(folder, files) as BlobPart, "application/zip");
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="border-hairline flex w-60 shrink-0 flex-col border-r">
        <div className="p-2">
          <label className="ring-line-focus border-input bg-surface flex h-8 items-center gap-2 rounded-md border px-2.5">
            <Search {...iconProps} className="text-subtle shrink-0" />
            <span className="sr-only">Search files</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files"
              className="placeholder:text-subtle min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FileTree
            paths={files.map((file) => file.path)}
            selected={selected}
            onSelect={onSelect}
            query={query}
          />
        </div>
        <div className="border-hairline border-t p-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            disabled={files.length === 0}
            onClick={downloadAll}
          >
            <FolderDown {...iconProps} />
            Download codebase
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-hairline flex h-10 shrink-0 items-stretch border-b">
          <ul aria-label="Open files" className="flex min-w-0 flex-1 overflow-x-auto">
            {tabs.map((path) => {
              const active = path === selected;
              return (
                <li
                  key={path}
                  className={cn(
                    "border-hairline group flex shrink-0 items-center border-r",
                    active ? "bg-surface text-text" : "text-muted hover:text-text",
                  )}
                >
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    title={path}
                    onClick={() => onSelect(path)}
                    className={cn(
                      "flex h-full items-center gap-1.5 pr-1 pl-3 font-mono text-xs",
                      active && "shadow-[inset_0_-2px_0_var(--accent)]",
                    )}
                  >
                    <FileTypeIcon path={path} />
                    {baseName(path)}
                  </button>
                  <button
                    type="button"
                    aria-label={`Close ${baseName(path)}`}
                    onClick={() => close(path)}
                    className="press text-subtle hover:text-text hover:bg-surface-2 mr-1 flex size-6 items-center justify-center rounded"
                  >
                    <X size={13} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {selected && content !== undefined ? (
            <div className="flex shrink-0 items-center gap-1 px-2">
              <Button variant="ghost" size="sm" onClick={() => void copy()} aria-live="polite">
                {copied ? <Check {...iconProps} /> : <Copy {...iconProps} />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => save(baseName(selected), content, "text/plain;charset=utf-8")}
              >
                <Download {...iconProps} />
                Download
              </Button>
            </div>
          ) : null}
        </div>

        {selected && content !== undefined ? (
          <>
            <p className="text-subtle border-hairline border-b px-4 py-1.5 font-mono text-[11px]">
              {selected.split("/").join("  ›  ")}
            </p>
            <div
              className="bg-surface min-h-0 flex-1 overflow-auto"
              tabIndex={0}
              role="region"
              aria-label={`Contents of ${selected}`}
            >
              <HighlightedCode path={selected} content={content} />
            </div>
          </>
        ) : (
          <p className="text-muted p-4 text-[13px]">Select a file to view it.</p>
        )}
      </div>
    </div>
  );
}
