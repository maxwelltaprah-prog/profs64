import { tool } from "ai";

import {
  lenientDocumentInputSchema,
  MAX_SPEC_BYTES,
  normaliseDocumentInput,
  specOf,
  imageIdsIn,
  type CreateDocumentInput,
} from "@/lib/documents/spec";

export interface DocumentStore {
  save(input: {
    kind: CreateDocumentInput["kind"];
    title: string;
    spec: unknown;
  }): Promise<{ id: string }>;
  // Which of these picture ids belong to this conversation. A deck can only use those.
  knownImages(ids: readonly string[]): Promise<ReadonlySet<string>>;
}

export type DocumentToolOutput =
  | { ok: true; id: string; kind: CreateDocumentInput["kind"]; title: string }
  | { ok: false; error: string };

// The agent's only tool. The input schema bounds every field; the size check below bounds the
// whole outline. What is stored is the validated outline, rendered to a file on download.
export function createAgentTools(store: DocumentStore) {
  return {
    create_document: tool({
      description:
        "Create a downloadable PowerPoint deck (kind pptx, with deck), Word document (kind docx, with document) or PDF (kind pdf, with document) from a structured outline. Pass deck or document as a JSON object, not a string.",
      inputSchema: lenientDocumentInputSchema,
      execute: async (raw): Promise<DocumentToolOutput> => {
        const normalised = normaliseDocumentInput(raw);
        if (!normalised.ok) return { ok: false, error: normalised.error };
        const input = normalised.value;
        const spec = specOf(input);
        if (new TextEncoder().encode(JSON.stringify(spec)).length > MAX_SPEC_BYTES) {
          return { ok: false, error: "The document is too long. Shorten it and try again." };
        }
        if (input.kind === "pptx") {
          const used = imageIdsIn(input.deck);
          if (used.length > 0) {
            let known: ReadonlySet<string>;
            try {
              known = await store.knownImages(used);
            } catch {
              return { ok: false, error: "The attached pictures could not be checked. Try again." };
            }
            if (used.some((imageId) => !known.has(imageId))) {
              return {
                ok: false,
                error:
                  "A slide uses a picture that is not attached to this chat. Use only the image ids listed in the person's messages.",
              };
            }
          }
        }
        try {
          const { id } = await store.save({ kind: input.kind, title: spec.title, spec });
          return { ok: true, id, kind: input.kind, title: spec.title };
        } catch {
          return { ok: false, error: "The document could not be saved. Try again." };
        }
      },
    }),
  };
}

// Stored replies keep only a short stub of a document tool call: the full outline is in the
// documents table, and replaying it on every turn would waste the model's context and credits.
export function compactAgentParts(parts: readonly unknown[]): unknown[] {
  return parts.map((part) => {
    if (
      part &&
      typeof part === "object" &&
      (part as { type?: unknown }).type === "tool-create_document"
    ) {
      const record = part as Record<string, unknown>;
      const input = record["input"];
      const kind =
        input && typeof input === "object" ? (input as { kind?: unknown }).kind : undefined;
      return { ...record, input: { kind: typeof kind === "string" ? kind : "unknown" } };
    }
    return part;
  });
}
