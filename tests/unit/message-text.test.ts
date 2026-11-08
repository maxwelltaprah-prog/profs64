import { describe, expect, it } from "vitest";

import { parseBlocks, parseInline } from "@/lib/workspace/message-text";

describe("parseInline", () => {
  it("reads bold and code and leaves everything else as text", () => {
    expect(parseInline("I added a **Contact** section in `App.tsx`.")).toEqual([
      { kind: "text", text: "I added a " },
      { kind: "strong", text: "Contact" },
      { kind: "text", text: " section in " },
      { kind: "code", text: "App.tsx" },
      { kind: "text", text: "." },
    ]);
  });

  it("keeps an unclosed marker as written once the text is final", () => {
    expect(parseInline("a **b")).toEqual([{ kind: "text", text: "a **b" }]);
    expect(parseInline("empty **** and ``")).toEqual([{ kind: "text", text: "empty **** and ``" }]);
  });

  it("styles an unclosed marker while streaming so no stray asterisks flash", () => {
    expect(parseInline("a **Cont", true)).toEqual([
      { kind: "text", text: "a " },
      { kind: "strong", text: "Cont" },
    ]);
    // A lone opener with nothing after it yet is held back entirely.
    expect(parseInline("a **", true)).toEqual([{ kind: "text", text: "a " }]);
  });

  it("does not understand links, images or HTML: they stay literal", () => {
    const text = '[x](javascript:alert(1)) ![i](u) <img src=x onerror="alert(1)">';
    expect(parseInline(text)).toEqual([{ kind: "text", text }]);
  });

  it("stays fast on a long message with many unmatched markers", () => {
    const started = performance.now();
    parseInline("**a`".repeat(5000));
    parseBlocks("- **a\n".repeat(5000));
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe("parseBlocks", () => {
  it("splits paragraphs, lists, headings and fenced code", () => {
    const blocks = parseBlocks(
      [
        "## Plan",
        "",
        "First line",
        "second line",
        "",
        "- one",
        "- two",
        "",
        "1. a",
        "2. b",
        "",
        "```tsx",
        "<A />",
        "```",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "list", "code"]);
    expect(blocks[2]).toMatchObject({ ordered: false });
    expect(blocks[3]).toMatchObject({ ordered: true });
    expect(blocks[4]).toEqual({ kind: "code", text: "<A />" });
  });

  it("keeps a code fence that has not closed yet", () => {
    expect(parseBlocks("```\nconst a = 1;")).toEqual([{ kind: "code", text: "const a = 1;" }]);
  });

  it("handles Windows line endings and empty input", () => {
    expect(parseBlocks("a\r\n\r\nb")).toHaveLength(2);
    expect(parseBlocks("")).toEqual([]);
  });
});
