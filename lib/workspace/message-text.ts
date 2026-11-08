// A small, safe reader for the formatting the assistant writes in chat: paragraphs, bullet and
// numbered lists, fenced code, headings, **bold** and `code`. It returns plain data that the
// panel renders as React text nodes, so model output is never turned into HTML, and it has no
// regular expressions over the input, so a hostile or huge message cannot make it slow.
//
// Links, images and raw HTML are deliberately not understood: they stay as the literal text.

export type Inline = { kind: "text" | "strong" | "code"; text: string };

export type Block =
  | { kind: "paragraph"; inline: Inline[] }
  | { kind: "heading"; inline: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; text: string };

const MAX_INLINE_RUN = 20_000;

// Splits one line of text into plain, bold and code runs. An opener with no closer is plain
// text, except while the reply is still streaming, where it is shown styled to the end so the
// person never sees a flash of stray asterisks or backticks.
export function parseInline(source: string, streaming = false): Inline[] {
  const text = source.length > MAX_INLINE_RUN ? source.slice(0, MAX_INLINE_RUN) : source;
  const runs: Inline[] = [];
  let plain = "";
  let index = 0;

  const flush = () => {
    if (plain) runs.push({ kind: "text", text: plain });
    plain = "";
  };

  while (index < text.length) {
    const rest = text.startsWith("`", index)
      ? { marker: "`", kind: "code" as const }
      : text.startsWith("**", index)
        ? { marker: "**", kind: "strong" as const }
        : null;

    if (!rest) {
      plain += text.charAt(index);
      index += 1;
      continue;
    }

    const start = index + rest.marker.length;
    const end = text.indexOf(rest.marker, start);
    if (end === -1) {
      if (streaming && start < text.length) {
        flush();
        runs.push({ kind: rest.kind, text: text.slice(start) });
        index = text.length;
      } else if (streaming) {
        // Just the opener so far: hold it back until there is something to style.
        index = text.length;
      } else {
        plain += rest.marker;
        index = start;
      }
      continue;
    }
    if (end === start) {
      // "****" or "``": nothing between the markers, keep them as written.
      plain += rest.marker + rest.marker;
      index = end + rest.marker.length;
      continue;
    }
    flush();
    runs.push({ kind: rest.kind, text: text.slice(start, end) });
    index = end + rest.marker.length;
  }
  flush();
  return runs;
}

const isDigit = (code: number) => code >= 48 && code <= 57;

function listMarker(line: string): { ordered: boolean; content: string } | null {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return { ordered: false, content: trimmed.slice(2) };
  }
  let digits = 0;
  while (digits < 3 && isDigit(trimmed.charCodeAt(digits))) digits += 1;
  if (digits > 0 && trimmed.charAt(digits) === "." && trimmed.charAt(digits + 1) === " ") {
    return { ordered: true, content: trimmed.slice(digits + 2) };
  }
  return null;
}

function headingText(line: string): string | null {
  let hashes = 0;
  while (hashes < line.length && line.charAt(hashes) === "#") hashes += 1;
  if (hashes === 0 || hashes > 4 || line.charAt(hashes) !== " ") return null;
  return line.slice(hashes + 1);
}

export function parseBlocks(text: string, streaming = false): Block[] {
  const lines = text.split("\n").map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = (last: boolean) => {
    if (paragraph.length === 0) return;
    blocks.push({
      kind: "paragraph",
      inline: parseInline(paragraph.join("\n"), streaming && last),
    });
    paragraph = [];
  };
  const flushList = (last: boolean) => {
    if (!list) return;
    const count = list.items.length;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map((item, i) => parseInline(item, streaming && last && i === count - 1)),
    });
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines.at(i) ?? "";
    const isLast = i === lines.length - 1;

    if (line.trimStart().startsWith("```")) {
      flushParagraph(false);
      flushList(false);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines.at(i) ?? "").trimStart().startsWith("```")) {
        body.push(lines.at(i) ?? "");
        i += 1;
      }
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph(false);
      flushList(false);
      continue;
    }

    const heading = headingText(line);
    if (heading !== null) {
      flushParagraph(false);
      flushList(false);
      blocks.push({ kind: "heading", inline: parseInline(heading, streaming && isLast) });
      continue;
    }

    const marker = listMarker(line);
    if (marker) {
      flushParagraph(false);
      if (list && list.ordered !== marker.ordered) flushList(false);
      list ??= { ordered: marker.ordered, items: [] };
      list.items.push(marker.content);
      continue;
    }

    flushList(false);
    paragraph.push(line);
  }
  flushParagraph(true);
  flushList(true);
  return blocks;
}
