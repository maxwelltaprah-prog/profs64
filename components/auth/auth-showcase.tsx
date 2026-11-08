import { Check } from "lucide-react";

// The right half of the sign-in pages: a still of the product doing its job. A request, the steps
// the assistant took, and the page it produced, layered so the glass cards sit over the preview.
// It is illustration only (the brand in the preview is invented), hidden from assistive tech, and
// not shown on small screens.
const STEPS = [
  "Created src/pages/Booking.tsx",
  "Created src/components/PriceList.tsx",
  "Edited src/index.css",
];
const PRICES = [
  ["Classic cut", "£22"],
  ["Skin fade", "£26"],
  ["Beard trim", "£14"],
] as const;

export function AuthShowcase() {
  return (
    <div aria-hidden="true" className="hidden p-3 lg:block">
      <div className="bg-ink border-ink-border relative h-full min-h-[640px] overflow-hidden rounded-2xl border">
        <svg
          className="text-ink-border absolute inset-0 size-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="auth-dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-dots)" />
        </svg>

        {/* The generated page, behind everything. */}
        <div className="rise rise-1 bg-paper text-paper-text border-paper-line absolute top-[23%] right-[7%] w-[56%] rounded-xl border shadow-[0_24px_60px_rgb(0_0_0/0.45)]">
          <div className="border-paper-line flex items-center justify-between border-b px-5 py-3">
            <span className="text-sm font-semibold tracking-tight">Fade &amp; Co.</span>
            <span className="text-paper-muted text-xs">Prices · Hours · Find us</span>
          </div>
          <div className="px-5 pt-6 pb-7">
            <p className="text-paper-muted text-[11px] font-medium tracking-wide uppercase">
              Walk-ins until 6pm
            </p>
            <p className="mt-1.5 text-2xl leading-tight font-semibold tracking-[-0.02em]">
              Sharp cuts,
              <br />
              no waiting.
            </p>
            <ul className="divide-paper-line border-paper-line mt-5 divide-y border-y text-sm">
              {PRICES.map(([name, price]) => (
                <li key={name} className="flex justify-between py-2.5">
                  <span>{name}</span>
                  <span className="tabular-nums">{price}</span>
                </li>
              ))}
            </ul>
            <span className="bg-paper-accent text-paper-accent-fg mt-5 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium">
              Book a chair
            </span>
          </div>
        </div>

        {/* The request. */}
        <div className="rise rise-2 glass-ink text-ink-text absolute top-[10%] left-[7%] w-[44%] rounded-xl border p-4 shadow-[0_12px_32px_rgb(0_0_0/0.35)]">
          <p className="text-ink-muted text-[11px] font-medium">You</p>
          <p className="mt-1 text-[13px] leading-5">
            A booking page for a barbershop: prices, opening hours and a button to book.
          </p>
        </div>

        {/* What the assistant did. */}
        <div className="rise rise-3 glass-ink text-ink-text absolute top-[55%] left-[6%] w-[46%] rounded-xl border p-4 shadow-[0_12px_32px_rgb(0_0_0/0.35)]">
          <p className="text-ink-muted text-[11px] font-medium">Buildr</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {STEPS.map((step) => (
              <li key={step} className="flex items-center gap-2 font-mono text-[12px]">
                <Check size={13} strokeWidth={2} className="text-ink-accent shrink-0" />
                <span className="truncate">{step}</span>
              </li>
            ))}
          </ul>
          <p className="text-ink-muted border-ink-border mt-3 border-t pt-2.5 text-[11px] tabular-nums">
            3 files · 0.42 credits
          </p>
        </div>

        <div className="rise rise-4 glass-ink text-ink-text absolute top-[21%] right-[10%] flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]">
          <span className="bg-ink-accent size-1.5 rounded-full" />
          Preview updated
        </div>

        <div className="rise rise-5 absolute right-8 bottom-8 left-8">
          <p className="text-ink-text max-w-md text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">
            Describe it. Buildr builds it.
          </p>
          <p className="text-ink-muted mt-2 max-w-sm text-sm">
            Real React files you can read and change, line by line.
          </p>
        </div>
      </div>
    </div>
  );
}
