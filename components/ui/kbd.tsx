import { type ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-hairline bg-surface-2 text-muted rounded-sm border px-1.5 py-0.5 font-mono text-[11px]">
      {children}
    </kbd>
  );
}
