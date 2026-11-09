import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

import { renderDocument } from "@/lib/documents/render";
import { toWinAnsi, wrap } from "@/lib/documents/render-pdf";
import { createDocumentInputSchema, fileNameFor, MAX_SPEC_BYTES } from "@/lib/documents/spec";

vi.mock("server-only", () => ({}));

export const SAMPLE_DOCUMENT = {
  title: "Quarterly plan",
  subtitle: "Prepared for the operations team",
  blocks: [
    { type: "heading", level: 1, text: "Goals" },
    {
      type: "paragraph",
      text: "We focus on three outcomes this quarter — with “smart quotes” and naïve accents.",
    },
    { type: "bullets", items: ["Ship the new onboarding", "Cut support time by 20%"] },
    { type: "bullets", ordered: true, items: ["Plan", "Build", "Review"] },
    {
      type: "table",
      rows: [
        ["Owner", "Task"],
        ["Ama", "Onboarding"],
        ["Kofi", "Support"],
      ],
    },
    { type: "paragraph", text: "Non-Latin text is replaced in PDFs: 你好 Ωmega." },
  ],
} as const;

export const SAMPLE_DECK = {
  title: "Launch review",
  subtitle: "November",
  slides: [
    { title: "What we shipped", bullets: ["Chat agent", "Documents"], notes: "Keep it short." },
    { title: "Next", body: "Free models when daily credits run out." },
  ],
} as const;

const bytesStart = (bytes: Uint8Array, length: number) =>
  String.fromCharCode(...bytes.subarray(0, length));

describe("document specs", () => {
  it("accept well-formed input and reject markup-free nonsense, extra keys and oversize", () => {
    expect(
      createDocumentInputSchema.safeParse({ kind: "docx", document: SAMPLE_DOCUMENT }).success,
    ).toBe(true);
    expect(createDocumentInputSchema.safeParse({ kind: "pptx", deck: SAMPLE_DECK }).success).toBe(
      true,
    );
    for (const bad of [
      { kind: "exe", document: SAMPLE_DOCUMENT },
      { kind: "docx", deck: SAMPLE_DECK },
      { kind: "pdf", document: { ...SAMPLE_DOCUMENT, script: "x" } },
      { kind: "pdf", document: { title: "x", blocks: [{ type: "html", text: "<b>" }] } },
      {
        kind: "pptx",
        deck: { title: "x", slides: Array.from({ length: 41 }, () => ({ title: "s" })) },
      },
      {
        kind: "docx",
        document: { title: "x", blocks: [{ type: "paragraph", text: "y".repeat(4001) }] },
      },
    ])
      expect(
        createDocumentInputSchema.safeParse(bad).success,
        JSON.stringify(bad).slice(0, 60),
      ).toBe(false);
    expect(MAX_SPEC_BYTES).toBe(204800);
  });

  it("makes safe file names", () => {
    expect(fileNameFor("Quarterly plan: Q4/2026", "docx")).toBe("Quarterly-plan-Q42026.docx");
    expect(fileNameFor("../../etc", "pdf")).toBe("etc.pdf");
    expect(fileNameFor("!!!", "pptx")).toBe("document.pptx");
  });
});

describe("rendering", () => {
  it("renders a Word document (a zip with the Office signature)", async () => {
    const bytes = await renderDocument("docx", SAMPLE_DOCUMENT);
    expect(bytesStart(bytes, 2)).toBe("PK");
    expect(bytes.length).toBeGreaterThan(3000);
  });

  it("renders a PowerPoint deck", async () => {
    const bytes = await renderDocument("pptx", SAMPLE_DECK);
    expect(bytesStart(bytes, 2)).toBe("PK");
    expect(bytes.length).toBeGreaterThan(10000);
  });

  it("renders a PDF that a PDF reader can load, with the title as metadata", async () => {
    const bytes = await renderDocument("pdf", SAMPLE_DOCUMENT);
    expect(bytesStart(bytes, 5)).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(loaded.getTitle()).toBe("Quarterly plan");
  });

  it("re-validates stored outlines before rendering", async () => {
    await expect(renderDocument("pdf", { title: "x", blocks: [] })).rejects.toThrow();
    await expect(renderDocument("pptx", SAMPLE_DOCUMENT)).rejects.toThrow();
  });

  it("wraps long text and replaces characters the PDF fonts cannot show", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(toWinAnsi("“Hi” — 你好", font)).toBe('"Hi" - ??');
    const lines = wrap("word ".repeat(200), font, 11, 300);
    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(300);
    const long = wrap("x".repeat(500), font, 11, 100);
    for (const line of long) expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(100);
  });
});
