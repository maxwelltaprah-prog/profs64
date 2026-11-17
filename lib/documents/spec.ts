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

// Visuals a slide can carry. Each is plain data drawn by the renderer as native, editable
// PowerPoint objects (charts, shapes, text); nothing is fetched, and no markup or code is accepted.
const chartVisual = z.strictObject({
  type: z.literal("chart"),
  kind: z.enum(["bar", "line", "pie", "doughnut"]),
  // Used as the chart's title on the slide.
  title: text(80).optional(),
  categories: z.array(text(40)).min(2).max(12),
  series: z
    .array(
      z.strictObject({
        name: text(40),
        values: z.array(z.number().finite().min(-1e12).max(1e12)).min(2).max(12),
      }),
    )
    .min(1)
    .max(4),
});
const statsVisual = z.strictObject({
  type: z.literal("stats"),
  items: z
    .array(z.strictObject({ value: text(14), label: text(70) }))
    .min(2)
    .max(4),
});
const processVisual = z.strictObject({
  type: z.literal("process"),
  steps: z
    .array(z.strictObject({ title: text(40), text: text(110).optional() }))
    .min(2)
    .max(6),
});
const timelineVisual = z.strictObject({
  type: z.literal("timeline"),
  events: z
    .array(z.strictObject({ label: text(20), title: text(40), text: text(110).optional() }))
    .min(2)
    .max(6),
});
// A picture the person attached to this conversation, referred to by its id.
const imageVisual = z.strictObject({
  type: z.literal("image"),
  imageId: z.uuid(),
  caption: text(120).optional(),
});
export const visualSchema = z.discriminatedUnion("type", [
  chartVisual,
  statsVisual,
  processVisual,
  timelineVisual,
  imageVisual,
]);
export type Visual = z.infer<typeof visualSchema>;

export const slideSchema = z.strictObject({
  title: text(150),
  bullets: z.array(text(300)).max(10).optional(),
  // Shown below the bullets, for a short supporting sentence or a quote.
  body: text(600).optional(),
  visual: visualSchema.optional(),
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

// What the tool accepts. Weaker models (the free ones in particular) sometimes send the outline as
// a JSON string, or leave out kind when deck or document already says which it is. The tool's
// JSON schema still shows the proper object shapes; normaliseDocumentInput then parses, infers
// and validates strictly, and explains the first problem so the model can correct it.
const MAX_OUTLINE_STRING = 400_000;
export const lenientDocumentInputSchema = z.object({
  kind: z.enum(["pptx", "docx", "pdf"]).optional(),
  deck: z.union([deckSpecSchema, z.string().max(MAX_OUTLINE_STRING)]).optional(),
  document: z.union([documentSpecSchema, z.string().max(MAX_OUTLINE_STRING)]).optional(),
});
export type LenientDocumentInput = z.infer<typeof lenientDocumentInputSchema>;

function parseMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function normaliseDocumentInput(
  raw: unknown,
): { ok: true; value: CreateDocumentInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null)
    return { ok: false, error: "Send an object with kind and deck or document." };
  const input = raw as Record<string, unknown>;
  const deck = parseMaybe(input["deck"]);
  const document = parseMaybe(input["document"]);
  const kind =
    input["kind"] ?? (deck !== undefined ? "pptx" : document !== undefined ? "docx" : undefined);
  const candidate = kind === "pptx" ? { kind, deck } : { kind, document };
  const result = createDocumentInputSchema.safeParse(candidate);
  if (result.success) return { ok: true, value: result.data };
  const issue = result.error.issues[0];
  const where = issue?.path.length ? issue.path.join(".") : "the outline";
  return {
    ok: false,
    error: `The outline is not valid at ${where}: ${issue?.message ?? "check its shape"}. Fix it and call create_document again.`,
  };
}

// The ids of the person's pictures a deck refers to.
export function imageIdsIn(deck: DeckSpec): string[] {
  const ids = new Set<string>();
  for (const slide of deck.slides) {
    if (slide.visual?.type === "image") ids.add(slide.visual.imageId);
  }
  return [...ids];
}
