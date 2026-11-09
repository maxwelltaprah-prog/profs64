import "server-only";

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { type DocumentSpec } from "./spec";

// A clean A4 layout with the built-in Helvetica fonts. Those fonts only cover Western European
// characters (WinAnsi), so anything else is replaced rather than failing the whole document.
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const WIDTH = PAGE.width - MARGIN * 2;
const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.38, 0.38, 0.42);
const RULE = rgb(0.85, 0.85, 0.87);

const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/[‘’‛]/g, "'"],
  [/[“”‟]/g, '"'],
  [/[–—]/g, "-"],
  [/…/g, "..."],
  [/ /g, " "],
  [/[•●]/g, "-"],
];

export function toWinAnsi(input: string, font: PDFFont): string {
  let text = input;
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement);
  let out = "";
  for (const char of text) {
    if (char === "\n" || char === "\t") {
      out += " ";
      continue;
    }
    try {
      font.encodeText(char);
      out += char;
    } catch {
      out += "?";
    }
  }
  return out;
}

export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A single word longer than the line is broken by characters.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export async function renderPdf(spec: DocumentSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(spec.title);
  pdf.setCreator("Buildr");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };
  const write = (
    raw: string,
    font: PDFFont,
    size: number,
    options: { color?: typeof INK; indent?: number; gap?: number } = {},
  ) => {
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.4;
    for (const line of wrap(toWinAnsi(raw, font), font, size, WIDTH - indent)) {
      ensure(lineHeight);
      y -= lineHeight;
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: options.color ?? INK });
    }
    y -= options.gap ?? 0;
  };

  write(spec.title, bold, 24, { gap: 6 });
  if (spec.subtitle) write(spec.subtitle, regular, 12, { color: MUTED, gap: 6 });
  ensure(12);
  page.drawLine({
    start: { x: MARGIN, y: y - 4 },
    end: { x: PAGE.width - MARGIN, y: y - 4 },
    thickness: 0.75,
    color: RULE,
  });
  y -= 18;

  for (const block of spec.blocks) {
    switch (block.type) {
      case "heading": {
        const size = [18, 14, 12][block.level - 1] ?? 12;
        ensure(size * 3);
        y -= 8;
        write(block.text, bold, size, { gap: 4 });
        break;
      }
      case "paragraph":
        write(block.text, regular, 11, { gap: 8 });
        break;
      case "bullets":
        block.items.forEach((item, index) => {
          const marker = block.ordered ? `${index + 1}.` : "-";
          ensure(16);
          page.drawText(marker, {
            x: MARGIN + 4,
            y: y - 15.4,
            size: 11,
            font: regular,
            color: MUTED,
          });
          write(item, regular, 11, { indent: 20, gap: 2 });
        });
        y -= 6;
        break;
      case "table": {
        const columns = Math.max(...block.rows.map((row) => row.length));
        const cellWidth = WIDTH / columns;
        block.rows.forEach((row, rowIndex) => {
          const font = rowIndex === 0 ? bold : regular;
          const cells = Array.from({ length: columns }, (_, column) =>
            wrap(toWinAnsi(row.at(column) ?? "", font), font, 10, cellWidth - 10),
          );
          const height = Math.max(...cells.map((lines) => lines.length)) * 14 + 8;
          ensure(height);
          cells.forEach((lines, column) =>
            lines.forEach((line, lineIndex) =>
              page.drawText(line, {
                x: MARGIN + column * cellWidth + 5,
                y: y - 14 - lineIndex * 14,
                size: 10,
                font,
                color: INK,
              }),
            ),
          );
          y -= height;
          page.drawLine({
            start: { x: MARGIN, y },
            end: { x: PAGE.width - MARGIN, y },
            thickness: 0.5,
            color: RULE,
          });
        });
        y -= 12;
        break;
      }
    }
  }
  return pdf.save();
}
