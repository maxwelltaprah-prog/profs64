import { ArrowDownRight, ArrowUpRight, Check, FileCode2 } from "lucide-react";

import { iconProps } from "@/components/ui/icons";

export function WorkflowIllustration() {
  return (
    <figure
      role="img"
      aria-label="Example of a coffee shop brief becoming an editable website and source files"
      className="relative mx-auto w-full max-w-[34rem] pb-8"
    >
      <div className="border-hairline bg-surface relative overflow-hidden rounded-xl border shadow-md">
        <div className="border-hairline flex h-10 items-center gap-2 border-b px-3">
          <span className="bg-danger size-2 rounded-full opacity-70" />
          <span className="bg-paper-accent size-2 rounded-full opacity-70" />
          <span className="bg-success size-2 rounded-full opacity-70" />
          <span className="bg-surface-2 text-subtle ml-2 min-w-0 flex-1 truncate rounded px-2 py-1 text-center font-mono text-[10px]">
            bean-there.local
          </span>
          <span className="text-subtle pr-1 font-mono text-[10px]">Example</span>
        </div>

        <div className="bg-paper text-paper-text p-4 sm:p-6">
          <div className="border-paper-line flex items-center justify-between border-b pb-3">
            <span className="text-[11px] font-semibold tracking-[0.16em]">BEAN THERE</span>
            <span className="text-paper-muted text-[10px]">Menu&nbsp;&nbsp; Visit</span>
          </div>

          <div className="grid min-h-44 grid-cols-[1fr_0.9fr] items-center gap-2 py-4 sm:gap-4 sm:py-5">
            <div>
              <p className="text-paper-accent text-[9px] font-medium tracking-[0.12em] uppercase sm:text-[10px]">
                Good mornings start here
              </p>
              <h2 className="mt-2 text-[22px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[30px]">
                Good coffee.
                <br />
                Good company.
              </h2>
              <p className="text-paper-muted mt-2 max-w-48 text-[10px] leading-4 sm:mt-3 sm:text-xs sm:leading-5">
                Your neighborhood table, from the first pour to the last crumb.
              </p>
              <span className="bg-paper-accent text-paper-accent-fg mt-3 inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[9px] font-medium sm:mt-4 sm:px-3 sm:text-[10px]">
                See what&apos;s brewing <ArrowUpRight size={12} />
              </span>
            </div>

            <svg
              viewBox="0 0 220 180"
              aria-hidden="true"
              className="text-paper-accent w-full"
              fill="none"
            >
              <circle cx="142" cy="82" r="63" fill="currentColor" opacity=".12" />
              <path
                d="M37 145V62c0-11 9-20 20-20h108c11 0 20 9 20 20v83"
                stroke="currentColor"
                strokeWidth="2"
                opacity=".45"
              />
              <path
                d="M49 145V67c0-7 5-12 12-12h100c7 0 12 5 12 12v78"
                fill="#fbfaf8"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity=".85"
              />
              <path
                d="M111 56v89M51 112h118"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity=".4"
              />
              <path d="M52 112h57v33H52zM112 112h56v33h-56z" fill="currentColor" opacity=".08" />
              <path
                d="M61 145c1-21 7-32 19-43m-12 24c-9-3-13-8-14-15m20 5c0-8 3-13 9-17m-3 46c1-17 8-27 21-33m-6 14c-8-1-12-5-14-11"
                stroke="#1c1b19"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M139 92c-6 0-11 5-11 11v34c0 12 9 21 21 21h16c12 0 21-9 21-21v-34c0-6-5-11-11-11z"
                fill="currentColor"
              />
              <path
                d="M175 103h7c9 0 14 6 14 14s-5 14-14 14h-5"
                stroke="#b45309"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path d="M137 101h40v8h-40z" fill="#fbfaf8" opacity=".86" />
              <path
                d="M147 84c-4-7 5-8 1-15m14 15c-4-7 5-8 1-15"
                stroke="#1c1b19"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".65"
              />
              <path
                d="M125 160h72"
                stroke="#1c1b19"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".35"
              />
            </svg>
          </div>

          <div className="border-paper-line border-t pt-3">
            <div className="text-paper-muted mb-1 flex justify-between text-[9px] tracking-[0.12em] uppercase">
              <span>From the counter</span>
              <span>Today&apos;s favorites</span>
            </div>
            <div className="divide-paper-line divide-y text-[10px] sm:text-[11px]">
              <div className="flex justify-between py-2">
                <span>Flat white</span>
                <span className="tabular-nums">$4.10</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Cardamom bun</span>
                <span className="tabular-nums">$3.50</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-ink text-ink-text border-ink-border absolute -right-1 bottom-0 w-52 rounded-lg border p-3 shadow-md sm:-right-4 sm:w-56">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-medium">
            <FileCode2 {...iconProps} size={13} className="text-ink-accent" />
            Editable source files
          </span>
          <span className="text-ink-muted font-mono text-[9px]">03</span>
        </div>
        <ul className="text-ink-muted mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[9px]">
          <li className="flex items-center gap-1">
            <Check size={10} className="text-ink-accent" /> App.tsx
          </li>
          <li className="flex items-center gap-1">
            <Check size={10} className="text-ink-accent" /> menu.ts
          </li>
          <li className="flex items-center gap-1">
            <Check size={10} className="text-ink-accent" /> styles.css
          </li>
          <li className="text-ink-muted">and more</li>
        </ul>
      </div>

      <div
        aria-hidden="true"
        className="text-subtle absolute -bottom-1 left-4 flex items-center gap-1.5 text-[10px] sm:left-8"
      >
        <ArrowDownRight size={13} />A starting point you can keep shaping
      </div>
    </figure>
  );
}
