import { tool } from "ai";

import {
  createDocumentInputSchema,
  MAX_SPEC_BYTES,
  specOf,
  type CreateDocumentInput,
} from "@/lib/documents/spec";

export interface DocumentStore {
  save(input: {
    kind: CreateDocumentInput["kind"];
    title: string;
    spec: unknown;
  }): Promise<{ id: string }>;
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
        "Create a downloadable PowerPoint deck (kind pptx, with deck), Word document (kind docx, with document) or PDF (kind pdf, with document) from a structured outline.",
      inputSchema: createDocumentInputSchema,
      execute: async (input): Promise<DocumentToolOutput> => {
        const spec = specOf(input);
        if (new TextEncoder().encode(JSON.stringify(spec)).length > MAX_SPEC_BYTES) {
          return { ok: false, error: "The document is too long. Shorten it and try again." };
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
