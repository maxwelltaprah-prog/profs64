"use client";

import { useEffect, useState } from "react";

import { readLastAuth } from "@/lib/workspace/last-auth";

// "Last used" marker for the sign-in method this browser used before. It renders nothing until the
// browser has been asked, so the server and first client render match.
export function LastUsed({ method }: { method: string }) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    // Reading browser storage after mount is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatch(readLastAuth() === method);
  }, [method]);
  if (!match) return null;
  return (
    <span className="border-hairline-strong bg-surface text-muted pointer-events-none absolute -top-2 right-3 rounded-full border px-2 py-px text-[11px] leading-4">
      Last used
    </span>
  );
}
