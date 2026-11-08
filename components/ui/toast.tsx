"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";

import { iconProps } from "./icons";

type ToastTone = "info" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  leaving?: boolean;
}

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside <ToastProvider>");
  return push;
}

const LIFETIME_MS = 6000;
// Matches the leave transition in globals.css (.toast-item[data-leaving]).
const LEAVE_MS = 120;

// Non-blocking: toasts sit in a polite live region, never take focus and dismiss themselves.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // Leaving is a state, not a removal: the item fades out first, then unmounts.
  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
    );
    timers.current.set(
      id,
      setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
        timers.current.delete(id);
      }, LEAVE_MS),
    );
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-3), { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), LIFETIME_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
    };
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            data-leaving={item.leaving ? "true" : undefined}
            className={cn(
              "toast-item bg-surface pointer-events-auto flex items-start gap-3 rounded-md border px-3 py-2.5 text-[13px] shadow-md",
              item.tone === "error"
                ? "border-danger text-text"
                : "border-hairline-strong text-text",
            )}
          >
            <p className="flex-1">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="press text-muted hover:text-text -m-1 rounded-sm p-1"
            >
              <X {...iconProps} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
