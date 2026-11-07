"use client";

import { Code2, MessageSquare, PanelRight } from "lucide-react";
import { useMemo, useState } from "react";

import { iconProps } from "@/components/ui/icons";
import { type ProjectFile, type StoredMessage } from "@/lib/db/projects";
import { cn } from "@/lib/utils/cn";

import { ChatPanel } from "./chat-panel";
import { CodeViewer } from "./code-viewer";
import { FileTree } from "./file-tree";
import { SplitPane } from "./split-pane";

type Tab = "code" | "preview";

export function Workspace({
  userId,
  projectId,
  files,
  messages,
  canUseAssistant,
}: {
  userId: string;
  projectId: string;
  files: ProjectFile[];
  messages: StoredMessage[];
  canUseAssistant: boolean;
}) {
  const [tab, setTab] = useState<Tab>("code");
  const [selected, setSelected] = useState<string | null>(files[0]?.path ?? null);
  const content = useMemo(
    () => files.find((file) => file.path === selected)?.content ?? null,
    [files, selected],
  );

  const tabs: Array<{ id: Tab; label: string; Icon: typeof Code2 }> = [
    { id: "code", label: "Code", Icon: Code2 },
    { id: "preview", label: "Preview", Icon: PanelRight },
  ];

  return (
    <SplitPane
      storageKey={`buildr:split:${userId}:${projectId}`}
      firstLabel="Chat"
      first={
        <>
          <h2 className="border-hairline flex h-9 items-center gap-2 border-b px-4 text-[13px] font-medium">
            <MessageSquare {...iconProps} />
            Chat
          </h2>
          <ChatPanel messages={messages} canUseAssistant={canUseAssistant} />
        </>
      }
      second={
        <>
          <div
            role="tablist"
            aria-label="Workspace view"
            className="border-hairline flex h-9 shrink-0 border-b px-2"
          >
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={cn(
                  "transition-ui flex items-center gap-1.5 border-b-2 px-3 text-[13px]",
                  tab === id
                    ? "border-accent text-text"
                    : "text-muted hover:text-text border-transparent",
                )}
              >
                <Icon {...iconProps} />
                {label}
              </button>
            ))}
          </div>
          {tab === "code" ? (
            <div
              role="tabpanel"
              id="panel-code"
              aria-labelledby="tab-code"
              className="flex min-h-0 flex-1"
            >
              <div className="border-hairline w-48 shrink-0 overflow-y-auto border-r">
                <FileTree
                  paths={files.map((file) => file.path)}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <CodeViewer path={selected} content={content} />
              </div>
            </div>
          ) : (
            <div
              role="tabpanel"
              id="panel-preview"
              aria-labelledby="tab-preview"
              className="flex flex-1 items-center justify-center p-8"
            >
              <div className="max-w-xs text-center">
                <p className="text-sm font-medium">Preview (coming next)</p>
                <p className="text-muted mt-1 text-[13px]">
                  A live preview of the project will appear here in a later release.
                </p>
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
