import "server-only";

import { renderDocx } from "./render-docx";
import { renderPdf } from "./render-pdf";
import { renderPptx } from "./render-pptx";
import { deckSpecSchema, documentSpecSchema } from "./spec";

// Re-validates the stored outline before rendering, so a row edited by hand can never feed
// unchecked data into a renderer.
export async function renderDocument(
  kind: "pptx" | "docx" | "pdf",
  spec: unknown,
): Promise<Uint8Array> {
  if (kind === "pptx") return renderPptx(deckSpecSchema.parse(spec));
  const document = documentSpecSchema.parse(spec);
  return kind === "docx" ? renderDocx(document) : renderPdf(document);
}
