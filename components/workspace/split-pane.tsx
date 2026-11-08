"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";
import { clampSize } from "@/lib/workspace/file-tree";

const MIN = 22;
const MAX = 70;
const STEP = 2;

// Two panes with a draggable, keyboard-operable separator. The size lives in a CSS variable set
// through the CSSOM, which the CSP allows (it only blocks style attributes in markup), and is
// remembered per user and project in localStorage. Below the md breakpoint the panes stack and
// the separator is hidden.
export function SplitPane({
  storageKey,
  defaultSize = 36,
  first,
  second,
  firstLabel,
  firstHidden = false,
}: {
  storageKey: string;
  defaultSize?: number;
  first: ReactNode;
  second: ReactNode;
  firstLabel: string;
  /** Hides the first pane but keeps it mounted, so work inside it (a streaming reply) continues. */
  firstHidden?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(defaultSize);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(storageKey));
      // Restoring a saved value after mount is the point of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored > 0) setSize(clampSize(stored, MIN, MAX));
    } catch {
      // Storage can be unavailable (private windows); the default size is fine.
    }
  }, [storageKey]);

  useEffect(() => {
    container.current?.style.setProperty("--split", `${size}%`);
  }, [size]);

  const persist = useCallback(
    (value: number) => {
      try {
        window.localStorage.setItem(storageKey, String(value));
      } catch {
        // Ignore: the layout simply will not be remembered.
      }
    },
    [storageKey],
  );

  const move = (clientX: number) => {
    const rect = container.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setSize(clampSize(((clientX - rect.left) / rect.width) * 100, MIN, MAX));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event.clientX);
  };
  const onPointerUp = () => persist(size);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = size;
    if (event.key === "ArrowLeft") next = size - STEP;
    else if (event.key === "ArrowRight") next = size + STEP;
    else if (event.key === "Home") next = MIN;
    else if (event.key === "End") next = MAX;
    else return;
    event.preventDefault();
    next = clampSize(next, MIN, MAX);
    setSize(next);
    persist(next);
  };

  return (
    <div ref={container} className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section
        aria-label={firstLabel}
        hidden={firstHidden}
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col md:w-(--split) md:flex-none",
          firstHidden ? "hidden" : "flex",
        )}
      >
        {first}
      </section>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${firstLabel.toLowerCase()}`}
        aria-valuenow={Math.round(size)}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        hidden={firstHidden}
        className={cn(
          "transition-ui bg-hairline hover:bg-accent focus-visible:bg-accent hidden w-1 shrink-0 cursor-col-resize touch-none",
          !firstHidden && "md:block",
        )}
      />
      <div
        className={cn(
          "border-hairline flex min-h-0 min-w-0 flex-1 flex-col border-t md:border-t-0",
          firstHidden && "border-t-0",
        )}
      >
        {second}
      </div>
    </div>
  );
}
