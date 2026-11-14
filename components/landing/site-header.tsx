"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

const LINKS = [
  ["#examples", "Examples"],
  ["#how", "How it works"],
  ["#security", "Security"],
  ["#credits", "Credits"],
  ["#faq", "Questions"],
] as const;

// Sticky header that gains a hairline once the page has scrolled, so it reads as part of the
// hero at the top and as a bar once content runs beneath it, with a light glass blur.
export function SiteHeader({ account }: { account: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "glass-bar sticky top-0 z-20 border-b transition-[border-color] duration-200",
        scrolled ? "border-hairline" : "border-transparent",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span aria-hidden="true" className="bg-brass size-5 rounded-md" />
          Buildr
        </Link>
        <nav aria-label="Page" className="text-muted hidden items-center gap-6 text-[13px] md:flex">
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="hover:text-text transition-ui underline-offset-4 hover:underline"
            >
              {label}
            </a>
          ))}
        </nav>
        <nav aria-label="Account" className="flex items-center gap-4 text-[13px]">
          {account}
        </nav>
      </div>
    </header>
  );
}
