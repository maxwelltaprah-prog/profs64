"use client";

import { AlertCircle, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { type ProjectFile } from "@/lib/db/projects";
import { buildPreview, type PreviewBundle, type Transpile } from "@/lib/preview/bundle";
import { ANIMATE_UTILITIES_CSS } from "@/lib/templates/animate-css";
import { SHADCN_TAILWIND_CONFIG } from "@/lib/templates/shadcn-theme";
import { cn } from "@/lib/utils/cn";

type Viewport = "desktop" | "tablet" | "phone";
type Status = "building" | "loading" | "ready" | "failed";

interface Note {
  kind: "error" | "warn" | "compile";
  text: string;
}

const FRAME_PATH = "/preview-frame";
const DEFAULT_VIEWPORT: { id: Viewport; label: string; Icon: typeof Monitor; className: string } = {
  id: "desktop",
  label: "Desktop",
  Icon: Monitor,
  className: "w-full",
};
const VIEWPORTS: Array<{ id: Viewport; label: string; Icon: typeof Monitor; className: string }> = [
  DEFAULT_VIEWPORT,
  { id: "tablet", label: "Tablet", Icon: Tablet, className: "w-[768px] max-w-full" },
  { id: "phone", label: "Phone", Icon: Smartphone, className: "w-[390px] max-w-full" },
];

// Runs the project in a sandboxed frame. The files are transpiled here, in the page, and the
// result is posted to the frame, which has no access to the app, its cookies or its storage.
// Every file change rebuilds; the frame is reloaded only when the output actually changed.
export function PreviewPanel({ files }: { files: ProjectFile[] }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const transpiler = useRef<Transpile | null>(null);
  const [transpilerReady, setTranspilerReady] = useState(false);
  const [bundle, setBundle] = useState<PreviewBundle | null>(null);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<Status>("building");
  const [notes, setNotes] = useState<Note[]>([]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const lastSignature = useRef<string>("");

  // The transpiler is a sizeable dependency, so it loads only when the preview is opened.
  useEffect(() => {
    let cancelled = false;
    void import("@/lib/preview/transpile").then((module) => {
      if (cancelled) return;
      transpiler.current = module.transpileWithSucrase;
      setTranspilerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fileMap = useMemo(() => new Map(files.map((file) => [file.path, file.content])), [files]);

  // Rebuild shortly after the files settle. A new frame is loaded only if the bundle changed.
  useEffect(() => {
    if (!transpilerReady || !transpiler.current) return;
    const transpile = transpiler.current;
    const timer = setTimeout(() => {
      const next = buildPreview(fileMap, transpile);
      const signature = JSON.stringify([next.modules, next.imports, next.css, next.entry]);
      if (signature === lastSignature.current) return;
      lastSignature.current = signature;
      setBundle(next);
      setNotes(next.errors.map((e) => ({ kind: "compile", text: `${e.path}: ${e.message}` })));
      if (next.errors.length > 0) {
        setStatus("failed");
        return;
      }
      setStatus("loading");
      setVersion((v) => v + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [fileMap, transpilerReady]);

  // Messages from the frame. Its origin is opaque ("null"), so identity is checked by source.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as { type?: string; text?: string; level?: string } | null;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "ready" && bundle) {
        frame.current.contentWindow?.postMessage(
          {
            type: "render",
            bundle: {
              ...bundle,
              // tailwindcss-animate as plain CSS: the config sent here cannot carry plugins.
              css: `${bundle.css}\n${ANIMATE_UTILITIES_CSS}`,
              tailwindConfig: SHADCN_TAILWIND_CONFIG,
            },
          },
          "*",
        );
      } else if (data.type === "rendered") {
        setStatus("ready");
      } else if (data.type === "error") {
        setStatus("failed");
        setNotes((current) => [...current, { kind: "error", text: String(data.text ?? "Error") }]);
      } else if (data.type === "console") {
        setNotes((current) =>
          [
            ...current,
            {
              kind: data.level === "warn" ? "warn" : "error",
              text: String(data.text ?? ""),
            } as Note,
          ].slice(-20),
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [bundle]);

  const reload = useCallback(() => {
    if (!bundle || bundle.errors.length > 0) return;
    setNotes([]);
    setStatus("loading");
    setVersion((v) => v + 1);
  }, [bundle]);

  const errorCount = notes.filter((note) => note.kind !== "warn").length;
  const current = VIEWPORTS.find((v) => v.id === viewport) ?? DEFAULT_VIEWPORT;

  return (
    <div
      role="tabpanel"
      id="panel-preview"
      aria-labelledby="tab-preview"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="border-hairline flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2">
        <div role="group" aria-label="Preview width" className="flex items-center gap-0.5">
          {VIEWPORTS.map(({ id, label, Icon }) => (
            <Button
              key={id}
              variant="ghost"
              size="icon"
              aria-label={label}
              aria-pressed={viewport === id}
              onClick={() => setViewport(id)}
              className={cn(viewport === id && "bg-surface-2 text-text")}
            >
              <Icon {...iconProps} />
            </Button>
          ))}
        </div>
        <p className="text-subtle flex items-center gap-2 text-xs" aria-live="polite">
          {status === "building" && "Preparing preview"}
          {status === "loading" && "Loading"}
          {status === "ready" && "Live"}
          {status === "failed" && (
            <>
              <AlertCircle {...iconProps} size={14} className="text-danger" />
              {errorCount === 1 ? "1 problem" : `${errorCount} problems`}
            </>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          disabled={!bundle || status === "building"}
        >
          <RefreshCw {...iconProps} />
          Reload
        </Button>
      </div>

      <div className="bg-surface-2 relative flex min-h-0 flex-1 justify-center overflow-auto p-3">
        <div
          className={cn(
            "bg-surface border-hairline relative flex min-h-full flex-col overflow-hidden rounded-md border transition-[width] duration-200 ease-out",
            current.className,
          )}
        >
          {status !== "ready" ? (
            <div
              className="absolute inset-0 z-10 flex flex-col gap-3 p-6"
              aria-hidden={status === "failed" ? undefined : "true"}
            >
              {status === "failed" ? (
                <div
                  role="alert"
                  className="border-hairline bg-surface mx-auto mt-10 w-full max-w-md rounded-md border p-4 text-[13px]"
                >
                  <p className="font-medium">The preview could not run</p>
                  <ul className="text-muted mt-2 flex flex-col gap-1 font-mono text-xs break-words">
                    {notes
                      .filter((note) => note.kind !== "warn")
                      .slice(0, 6)
                      .map((note, index) => (
                        <li key={`${index}-${note.text.slice(0, 24)}`}>{note.text}</li>
                      ))}
                  </ul>
                  <p className="text-muted mt-3">
                    Ask the assistant to fix it, or change the file and the preview will retry.
                  </p>
                </div>
              ) : (
                <>
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                </>
              )}
            </div>
          ) : null}
          {bundle && bundle.errors.length === 0 ? (
            <iframe
              key={version}
              ref={frame}
              title="Project preview"
              src={`${FRAME_PATH}?v=${version}`}
              sandbox="allow-scripts allow-forms allow-modals"
              referrerPolicy="no-referrer"
              className={cn(
                "min-h-full w-full flex-1 bg-white transition-opacity duration-200",
                status === "ready" ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
        </div>
      </div>

      {status === "ready" && notes.length > 0 ? (
        <div className="border-hairline max-h-28 shrink-0 overflow-auto border-t px-3 py-2 font-mono text-xs">
          {notes.slice(-5).map((note, index) => (
            <p
              key={`${index}-${note.text.slice(0, 24)}`}
              className={cn(note.kind === "warn" ? "text-muted" : "text-danger")}
            >
              {note.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
