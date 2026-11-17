"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SlideSvg } from "@/components/chat/slide-svg";
import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { type DeckSpec, type DocumentSpec } from "@/lib/documents/spec";
import { documentUrl, type AgentDocument } from "@/lib/workspace/agent";

type Loaded =
  | { kind: "pptx"; title: string; deck: DeckSpec; images: Record<string, string> }
  | { kind: "docx" | "pdf"; title: string; document: DocumentSpec };

// A preview of a document the assistant made, drawn from its stored outline: slides as pictures,
// Word and PDF as a page. A close approximation; the download is the real file.
export function DocumentPreview({
  conversationId,
  document,
  onClose,
}: {
  conversationId: string;
  document: AgentDocument;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(-1);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/documents/${document.id}/preview`,
        );
        if (!response.ok) throw new Error("preview failed");
        const body = (await response.json()) as Loaded;
        if (!cancelled) setLoaded(body);
      } catch {
        if (!cancelled)
          setError("The preview could not be loaded. You can still download the file.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, document.id]);

  const count = loaded?.kind === "pptx" ? loaded.deck.slides.length + 1 : 0;
  const go = (delta: number) =>
    setSlide((current) => Math.min(count - 2, Math.max(-1, current + delta)));

  return (
    <dialog
      ref={dialog}
      aria-label={`Preview of ${document.title}`}
      onClose={onClose}
      onKeyDown={(event) => {
        if (loaded?.kind !== "pptx") return;
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
      className="glass border-hairline m-auto h-[min(92dvh,56rem)] w-[min(96vw,64rem)] overflow-hidden rounded-2xl border p-0 backdrop:bg-black/50"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="border-hairline flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{document.title}</h2>
            <p className="text-muted text-xs">
              Preview. Layout in the downloaded file may differ slightly.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={documentUrl(conversationId, document.id)}
              download
              className="press border-hairline-strong bg-surface hover:bg-surface-2 inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium"
            >
              <Download {...iconProps} />
              Download
            </a>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close preview"
              onClick={() => dialog.current?.close()}
            >
              <X {...iconProps} />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}
          {!loaded && !error ? <p className="text-muted text-sm">Loading preview</p> : null}
          {loaded?.kind === "pptx" ? (
            <div className="flex flex-col gap-3">
              <div className="border-hairline overflow-hidden rounded-lg border shadow-sm">
                <SlideSvg deck={loaded.deck} index={slide} images={loaded.images} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={() => go(-1)} disabled={slide <= -1}>
                  <ChevronLeft {...iconProps} />
                  Previous
                </Button>
                <p className="text-muted text-xs tabular-nums" aria-live="polite">
                  Slide {slide + 2} of {count}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => go(1)}
                  disabled={slide >= count - 2}
                >
                  Next
                  <ChevronRight {...iconProps} />
                </Button>
              </div>
              <ul aria-label="Slides" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {Array.from({ length: count }, (_, i) => i - 1).map((i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSlide(i)}
                      aria-label={`Go to slide ${i + 2}`}
                      aria-current={i === slide ? "true" : undefined}
                      className={`border-hairline block w-full overflow-hidden rounded-md border ${i === slide ? "ring-accent ring-2" : "opacity-80 hover:opacity-100"}`}
                    >
                      <SlideSvg deck={loaded.deck} index={i} images={loaded.images} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {loaded && loaded.kind !== "pptx" ? <Paper spec={loaded.document} /> : null}
        </div>
      </div>
    </dialog>
  );
}

function Paper({ spec }: { spec: DocumentSpec }) {
  return (
    <article className="mx-auto max-w-2xl rounded-lg bg-white p-8 text-[#1f2328] shadow-md sm:p-12">
      <h1 className="text-2xl font-bold tracking-tight">{spec.title}</h1>
      {spec.subtitle ? <p className="mt-1 text-[#5f6670]">{spec.subtitle}</p> : null}
      <div className="mt-6 flex flex-col gap-3 text-[14px] leading-6">
        {spec.blocks.map((block, i) => {
          if (block.type === "heading") {
            const size =
              block.level === 1 ? "text-xl" : block.level === 2 ? "text-lg" : "text-base";
            return (
              <h2 key={i} className={`${size} mt-3 font-semibold`}>
                {block.text}
              </h2>
            );
          }
          if (block.type === "paragraph") return <p key={i}>{block.text}</p>;
          if (block.type === "bullets") {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List
                key={i}
                className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6`}
              >
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </List>
            );
          }
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r} className={r === 0 ? "bg-[#f5f7f9] font-semibold" : ""}>
                      {row.map((cell, c) => (
                        <td key={c} className="border border-[#dde1e6] px-2 py-1 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </article>
  );
}
