import { z } from "zod";

// What the assistant writes when it creates a document: a small, validated outline, never markup
// or code. The server renders the real .pptx, .docx or .pdf from it on download. Every string and
// list is bounded so one document stays well under the 256 KB the database allows.

const text = (max: number) => z.string().trim().min(1).max(max);

export const blockSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: text(300),
  }),
  z.strictObject({ type: z.literal("paragraph"), text: text(4000) }),
  z.strictObject({
    type: z.literal("bullets"),
    ordered: z.boolean().optional(),
    items: z.array(text(500)).min(1).max(50),
  }),
  z.strictObject({
    type: z.literal("table"),
    // The first row is the header.
    rows: z
      .array(z.array(z.string().max(300)).min(1).max(8))
      .min(2)
      .max(60),
  }),
]);
export type Block = z.infer<typeof blockSchema>;

export const documentSpecSchema = z.strictObject({
  title: text(120),
  subtitle: text(200).optional(),
  blocks: z.array(blockSchema).min(1).max(200),
});
export type DocumentSpec = z.infer<typeof documentSpecSchema>;

export const slideSchema = z.strictObject({
  title: text(150),
  bullets: z.array(text(300)).max(10).optional(),
  // Shown below the bullets, for a short supporting sentence or a quote.
  body: text(600).optional(),
  notes: text(2000).optional(),
});
export const deckSpecSchema = z.strictObject({
  title: text(120),
  subtitle: text(200).optional(),
  slides: z.array(slideSchema).min(1).max(40),
});
export type DeckSpec = z.infer<typeof deckSpecSchema>;

export const createDocumentInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("pptx"), deck: deckSpecSchema }),
  z.strictObject({ kind: z.literal("docx"), document: documentSpecSchema }),
  z.strictObject({ kind: z.literal("pdf"), document: documentSpecSchema }),
]);
export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;

export const MAX_SPEC_BYTES = 200 * 1024;

export function specOf(input: CreateDocumentInput): DocumentSpec | DeckSpec {
  return input.kind === "pptx" ? input.deck : input.document;
}

export const MIME: Readonly<Record<"pptx" | "docx" | "pdf", string>> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export function fileNameFor(title: string, kind: "pptx" | "docx" | "pdf"): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "document"}.${kind}`;
}
