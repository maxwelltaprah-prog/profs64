"use client";

import { type UIMessage } from "ai";
import { Code2, MessageSquare, PanelLeftClose, PanelLeftOpen, PanelRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { iconProps } from "@/components/ui/icons";
import { type ProjectFile } from "@/lib/db/projects";
import { cn } from "@/lib/utils/cn";
import { type OutputInfo } from "@/lib/workspace/outputs";

import { ChatPanel } from "./chat-panel";
import { CodeViewer } from "./code-viewer";
import { FileTree } from "./file-tree";
import { PreviewPanel } from "./preview-panel";
import { SplitPane } from "./split-pane";

type Tab = "code" | "preview";

export function Workspace({
  userId,
  projectId,
  files,
  messages,
  outputs,
  balance,
  canUseAssistant,
}: {
  userId: string;
  projectId: string;
  files: ProjectFile[];
  messages: UIMessage[];
  outputs: Record<string, OutputInfo>;
  balance: number;
  canUseAssistant: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("preview");
  const [chatHidden, setChatHidden] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const hiddenKey = `buildr:chat-hidden:${userId}:${projectId}`;
  const [current, setCurrent] = useState<ProjectFile[]>(files);
  const [selected, setSelected] = useState<string | null>(files[0]?.path ?? null);
  const content = useMemo(
    () => current.find((file) => file.path === selected)?.content ?? null,
    [current, selected],
  );

  // Whether the chat was hidden is remembered per person and project, in this browser only.
  useEffect(() => {
    try {
      // Restoring a saved value after mount is the point of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(hiddenKey) === "1") setChatHidden(true);
    } catch {
      // Storage can be unavailable; the chat simply starts visible.
    }
  }, [hiddenKey]);
  const toggleChat = useCallback(
    (hidden: boolean) => {
      setChatHidden(hidden);
      try {
        window.localStorage.setItem(hiddenKey, hidden ? "1" : "0");
      } catch {
        // Ignore: the choice just will not be remembered.
      }
    },
    [hiddenKey],
  );
  const openFile = useCallback((path: string) => {
    setSelected(path);
    setTab("code");
  }, []);
  const openPreview = useCallback(() => setTab("preview"), []);

  // The server is the source of truth for files, so the tree is refreshed from it as the assistant
  // works. Calls are coalesced and a late response never overwrites a newer one.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const refreshFiles = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const ticket = ++latest.current;
      try {
        const response = await fetch(`/api/projects/${projectId}/files`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { files: ProjectFile[] };
        if (ticket !== latest.current) return;
        setCurrent(data.files);
        setSelected((previous) => previous ?? data.files[0]?.path ?? null);
      } catch {
        // The next refresh, or the end-of-turn refresh, will catch up.
      }
    }, 150);
  }, [projectId]);

  // The stream closes before the server has settled the charge, so one refresh can read the
  // old balance. Refresh now for the files and again shortly after for the credits.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinished = useCallback(() => {
    refreshFiles();
    router.refresh();
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => router.refresh(), 2000);
  }, [refreshFiles, router]);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const tabs: Array<{ id: Tab; label: string; Icon: typeof Code2 }> = [
    { id: "code", label: "Code", Icon: Code2 },
    { id: "preview", label: "Preview", Icon: PanelRight },
  ];

  return (
    <SplitPane
      storageKey={`buildr:split:${userId}:${projectId}`}
      firstLabel="Chat"
      firstHidden={chatHidden}
      first={
        <>
          <div className="border-hairline flex h-9 shrink-0 items-center justify-between border-b pr-1.5 pl-4">
            <h2 className="flex items-center gap-2 text-[13px] font-medium">
              <MessageSquare {...iconProps} />
              Chat
            </h2>
            <button
              type="button"
              aria-label="Hide chat"
              title="Hide chat"
              onClick={() => toggleChat(true)}
              className="press text-muted hover:text-text hover:bg-surface-2 flex size-7 items-center justify-center rounded-md"
            >
              <PanelLeftClose {...iconProps} />
            </button>
          </div>
          <ChatPanel
            projectId={projectId}
            initialMessages={messages}
            initialOutputs={outputs}
            projectFiles={current}
            onOpenFile={openFile}
            onOpenPreview={openPreview}
            onBusyChange={setChatBusy}
            canUseAssistant={canUseAssistant}
            hasCredits={balance >= 1}
            onFilesChanged={refreshFiles}
            onFinished={onFinished}
          />
        </>
      }
      second={
        <>
          <div
            role="tablist"
            aria-label="Workspace view"
            className="border-hairline flex h-9 shrink-0 items-stretch border-b px-2"
          >
            {chatHidden ? (
              <button
                type="button"
                aria-label="Show chat"
                title="Show chat"
                onClick={() => toggleChat(false)}
                className="press text-muted hover:text-text relative mr-1 flex items-center gap-1.5 px-2 text-[13px]"
              >
                <PanelLeftOpen {...iconProps} />
                Chat
                {chatBusy ? (
                  <span
                    aria-label="The assistant is working"
                    className="thinking-dot bg-accent absolute top-2 right-0.5"
                  />
                ) : null}
              </button>
            ) : null}
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
                  "press flex items-center gap-1.5 border-b-2 px-3 text-[13px]",
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
                  paths={current.map((file) => file.path)}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <CodeViewer path={selected} content={content} />
              </div>
            </div>
          ) : (
            <PreviewPanel files={current} />
          )}
        </>
      }
    />
  );
}
