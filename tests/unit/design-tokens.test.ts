import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");

// Pull `--name: #hex;` declarations out of one block (selector line through its closing brace).
function tokensIn(selectorStart: string): Map<string, string> {
  const start = css.indexOf(selectorStart);
  expect(start, `block not found: ${selectorStart}`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  const block = css.slice(start, end);
  const tokens = new Map<string, string>();
  for (const line of block.split("\n")) {
    const match = /^\s*--([\w-]+):\s*(#[0-9a-fA-F]{6});/.exec(line);
    if (match?.[1] && match[2]) tokens.set(match[1], match[2].toLowerCase());
  }
  return tokens;
}

const channel = (hex: string, offset: number) => {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) =>
  0.2126 * channel(hex.slice(1), 0) +
  0.7152 * channel(hex.slice(1), 2) +
  0.0722 * channel(hex.slice(1), 4);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const themes: [string, Map<string, string>][] = [
  ["light", tokensIn(":root {")],
  ["dark", tokensIn(':root[data-theme="dark"] {')],
  ["dark (system preference)", tokensIn(':root:not([data-theme="light"]) {')],
];

// WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for non-text UI such as borders on inputs and focus rings.
const TEXT_PAIRS: [string, string][] = [
  ["text", "bg"],
  ["text", "surface"],
  ["text", "surface-2"],
  ["text-muted", "bg"],
  ["text-muted", "surface"],
  ["text-muted", "surface-2"],
  ["text-subtle", "bg"],
  ["text-subtle", "surface"],
  ["text-subtle", "surface-2"],
  ["accent", "bg"],
  ["accent", "surface"],
  ["accent-hover", "surface"],
  ["accent-fg", "accent"],
  ["accent-fg", "accent-hover"],
  ["accent", "accent-subtle"],
  ["danger", "surface"],
  ["danger", "danger-subtle"],
  ["ink-text", "ink"],
  ["ink-muted", "ink"],
  ["ink-muted", "ink-2"],
  ["ink-accent", "ink"],
  ["ink-text", "ink-2"],
  ["paper-text", "paper"],
  ["paper-muted", "paper"],
  ["paper-accent-fg", "paper-accent"],
  ["code-kw", "surface"],
  ["code-str", "surface"],
  ["code-fn", "surface"],
  ["code-num", "surface"],
  ["code-type", "surface"],
  ["code-com", "surface"],
  ["code-tag", "surface"],
  ["code-attr", "surface"],
  ["code-op", "surface"],
  ["code-punct", "surface"],
  ["success", "surface"],
];

describe.each(themes)("%s theme tokens", (_name, tokens) => {
  it("defines every token the pairs below use", () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      expect(tokens.has(fg), fg).toBe(true);
      expect(tokens.has(bg), bg).toBe(true);
    }
  });

  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    const ratio = contrast(tokens.get(fg) ?? "#000000", tokens.get(bg) ?? "#ffffff");
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring and form-control borders meet 3:1 against the surfaces they sit on", () => {
    for (const surface of ["surface", "bg", "surface-2"]) {
      const background = tokens.get(surface) ?? "";
      expect(
        contrast(tokens.get("focus") ?? "", background),
        `focus on ${surface}`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(tokens.get("input-border") ?? "", background),
        `input-border on ${surface}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("theme definitions stay in sync", () => {
  it("adds brass only as a supporting Buildr brand-mark color", () => {
    expect(css).toContain("--brass: #b88746;");
    expect(css).toContain("--color-brass: var(--brass);");
    expect(
      readFileSync(
        path.resolve(import.meta.dirname, "../../components/home/home-sidebar.tsx"),
        "utf8",
      ),
    ).toContain("bg-brass size-5 rounded-md");
    expect(
      readFileSync(path.resolve(import.meta.dirname, "../../app/(auth)/layout.tsx"), "utf8"),
    ).toContain("bg-brass size-5 rounded-md");
    expect(
      readFileSync(
        path.resolve(import.meta.dirname, "../../components/landing/site-header.tsx"),
        "utf8",
      ),
    ).toContain("bg-brass size-5 rounded-md");
  });

  it("the system-preference dark block matches the explicit dark block", () => {
    const [, explicit] = themes[1] ?? [];
    const [, system] = themes[2] ?? [];
    expect(Object.fromEntries(system ?? [])).toEqual(Object.fromEntries(explicit ?? []));
  });

  it("uses a single accent hue family and no gradients or glows", () => {
    expect(css).not.toMatch(/gradient\(/);
    expect(css).not.toMatch(/drop-shadow|glow/i);
  });

  // Owner decision 2026-11-08: subtle glass is allowed, but only through the three glass classes,
  // each with a solid fallback for unsupported blur and for reduced transparency.
  it("keeps backdrop blur inside the glass classes, with solid fallbacks", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{[^{}]*backdrop-filter[^{}]*\}/g)].map((m) =>
      (m[1] ?? "").trim(),
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const selector of rules) expect(selector).toMatch(/^\.glass(-bar|-ink)?$/);
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\)/);
    expect(css).toContain("prefers-reduced-transparency: reduce");
  });

  it("motion tokens stay in the 150-250ms range and reduced motion is respected", () => {
    const durations = [...css.matchAll(/--duration-(?:fast|base|slow):\s*(\d+)ms/g)].map((m) =>
      Number(m[1]),
    );
    expect(durations).toEqual([150, 200, 250]);
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  // Rules from the installed design-engineering skills (.claude/skills/emil-design-eng).
  it("follows the motion rules: strong curves, no transition:all, no ease-in, press 0.97", () => {
    expect(css).toMatch(/--ease-out:\s*cubic-bezier\(0\.23,\s*1,\s*0\.32,\s*1\)/);
    expect(css).toMatch(/--ease-in-out:\s*cubic-bezier\(0\.77,\s*0,\s*0\.175,\s*1\)/);
    expect(css).not.toMatch(/transition(?:-property)?:\s*all/);
    expect(css).not.toMatch(/ease-in(?!-out)/);
    expect(css).toMatch(/--duration-press:\s*160ms/);
    expect(css).toMatch(/\.press:active:not\(:disabled\)\s*\{\s*transform:\s*scale\(0\.97\)/);
    // Nothing enters from scale(0) and hover motion is gated to precise pointers.
    expect(css).not.toMatch(/scale\(0\)/);
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.lift:hover/);
  });

  it("carries the phone baseline: tap flash off, 16px inputs on touch, no zoom lock", () => {
    expect(css).toContain("-webkit-tap-highlight-color: transparent");
    expect(css).toMatch(
      /@media \(pointer: coarse\)\s*\{\s*input,\s*textarea,\s*select\s*\{\s*font-size: 16px/,
    );
    const layout = readFileSync(path.resolve(import.meta.dirname, "../../app/layout.tsx"), "utf8");
    expect(layout).toContain('viewportFit: "cover"');
    expect(layout).not.toMatch(/maximumScale|userScalable/);
  });
});
