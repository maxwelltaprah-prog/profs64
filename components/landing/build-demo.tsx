"use client";

import { Check, FileText, Folder } from "lucide-react";
import { useEffect, useState } from "react";

import { iconProps } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

// One orchestrated replay of a real request: the prompt, the tool calls as they land, the tree
// and code filling in, and the credit balance settling. The figures are from an actual run.
// With reduced motion the final state is shown at once.

const PROMPT = "Build a landing page for a coffee shop with a menu and opening hours.";

const TOOL_LINES = [
  { step: 2, text: "Created src/components/Hero.tsx" },
  { step: 3, text: "Created src/components/Menu.tsx" },
  { step: 4, text: "Updated src/App.tsx" },
] as const;

const TREE = [
  { depth: 0, name: "src", kind: "folder", step: 0 },
  { depth: 1, name: "components", kind: "folder", step: 2 },
  { depth: 2, name: "Hero.tsx", kind: "file", step: 2 },
  { depth: 2, name: "Menu.tsx", kind: "file", step: 3 },
  { depth: 1, name: "App.tsx", kind: "file", step: 0, changed: 4 },
  { depth: 1, name: "index.css", kind: "file", step: 0 },
  { depth: 1, name: "main.tsx", kind: "file", step: 0 },
  { depth: 0, name: "index.html", kind: "file", step: 0 },
  { depth: 0, name: "package.json", kind: "file", step: 0 },
] as const;

const CODE = `export function Menu() {
  const drinks = [
    ["Espresso", "3.20"],
    ["Flat white", "4.10"],
    ["Pour-over", "4.60"],
    ["Cold brew", "4.40"],
  ];
  return (
    <section className="px-6 py-16">
      <h2 className="text-2xl font-semibold">Menu</h2>
      <ul className="mt-6 divide-y">
        {drinks.map(([name, price]) => (
          <li key={name} className="flex justify-between py-3">
            <span>{name}</span>
            <span className="tabular-nums">{price}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}`;

const FINAL_STEP = 6;
const STEP_MS = [900, 1100, 1300, 1100, 1100, 1200, 5000] as const;

export function BuildDemo() {
  const [step, setStep] = useState(0);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference
      setStep(FINAL_STEP);
      return;
    }
    setAnimated(true);
    let current = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      current = current >= FINAL_STEP ? 0 : current + 1;
      setStep(current);
      timer = setTimeout(advance, STEP_MS[current] ?? 1000);
    };
    timer = setTimeout(advance, STEP_MS[0]);
    return () => clearTimeout(timer);
  }, []);

  const shown = (at: number) => step >= at;
  const reveal = (at: number) =>
    cn(
      animated && "transition-opacity duration-300 ease-out",
      shown(at) ? "opacity-100" : "opacity-0",
    );
  const balance = shown(6) ? "19.74" : "20.00";

  return (
    <figure
      aria-label="A replay of one request: the prompt, each file the assistant wrote, and the charge"
      className="border-ink-border bg-ink text-ink-text overflow-hidden rounded-lg border shadow-md"
    >
      <div className="border-ink-border flex h-11 items-center justify-between border-b px-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Buildr</span>
          <span className="text-ink-muted">coffee-shop</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <span className={cn("font-medium", shown(6) && animated && "text-ink-accent")}>
            {balance}
          </span>
          <span className="text-ink-muted">credits</span>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="border-ink-border flex min-h-[22rem] flex-col gap-4 border-b p-5 text-[13px] leading-6 md:border-r md:border-b-0">
          <div className={reveal(1)}>
            <p className="text-ink-muted">You</p>
            <p>{PROMPT}</p>
          </div>
          <div className={reveal(2)}>
            <p className="text-ink-muted">Assistant</p>
            <ul className="mt-1 flex flex-col gap-1 font-mono text-xs">
              {TOOL_LINES.map((line) => (
                <li key={line.text} className={cn("flex items-center gap-2", reveal(line.step))}>
                  <Check {...iconProps} size={14} className="text-ink-accent" />
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
            <p className={cn("mt-3", reveal(5))}>
              Added a hero, a four-item menu and opening hours. The menu prices are in a plain array
              in Menu.tsx so you can edit them.
            </p>
          </div>
          <p
            className={cn(
              "border-ink-border text-ink-muted mt-auto border-t pt-3 font-mono text-xs tabular-nums",
              reveal(6),
            )}
          >
            4,236 input tokens, 419 output. $0.0078, charged as 0.26 credits.
          </p>
        </div>

        <div className="grid sm:grid-cols-[11rem_minmax(0,1fr)]">
          <ul
            aria-label="Project files"
            className="border-ink-border py-3 text-xs leading-6 sm:border-r"
          >
            {TREE.map((node) => (
              <li
                key={`${node.depth}-${node.name}`}
                className={cn(
                  "flex items-center gap-1.5 pr-3",
                  node.depth === 0 && "pl-3",
                  node.depth === 1 && "pl-7",
                  node.depth === 2 && "pl-11",
                  reveal(node.step),
                  "changed" in node && shown(node.changed) && "text-ink-accent",
                  node.name === "Menu.tsx" && shown(3) && "bg-ink-2",
                )}
              >
                {node.kind === "folder" ? (
                  <Folder {...iconProps} size={14} className="text-ink-muted" />
                ) : (
                  <FileText {...iconProps} size={14} className="text-ink-muted" />
                )}
                <span className="truncate">{node.name}</span>
              </li>
            ))}
          </ul>
          <div className="hidden min-w-0 sm:block">
            <div className="border-ink-border text-ink-muted flex h-9 items-center border-b px-4 font-mono text-xs">
              <span className={reveal(3)}>src/components/Menu.tsx</span>
            </div>
            <pre
              className={cn(
                "text-ink-text max-h-80 overflow-hidden p-4 font-mono text-xs leading-5",
                reveal(3),
              )}
            >
              {CODE}
            </pre>
          </div>
        </div>
      </div>
    </figure>
  );
}
