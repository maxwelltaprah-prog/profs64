// Browser-side helpers for the chat agent. Pure and zod-free (the CSP blocks zod's code
// generation in the browser). Everything read from a reply is checked before it is shown.

export type DocumentKind = "pptx" | "docx" | "pdf";

export interface AgentDocument {
  id: string;
  kind: DocumentKind;
  title: string;
}

const KINDS = new Set<string>(["pptx", "docx", "pdf"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const KIND_LABEL: Readonly<Record<DocumentKind, string>> = {
  pptx: "PowerPoint",
  docx: "Word document",
  pdf: "PDF",
};

/** A document tool part: done with a document, still being written, or failed with a message. */
export type DocumentStep =
  | { state: "done"; document: AgentDocument }
  | { state: "working" }
  | { state: "failed"; message: string };

export function documentStep(part: unknown): DocumentStep | null {
  if (!isRecord(part) || part["type"] !== "tool-create_document") return null;
  const state = part["state"];
  if (state === "output-available") {
    const output = part["output"];
    if (
      isRecord(output) &&
      output["ok"] === true &&
      typeof output["id"] === "string" &&
      UUID.test(output["id"]) &&
      typeof output["kind"] === "string" &&
      KINDS.has(output["kind"]) &&
      typeof output["title"] === "string"
    ) {
      return {
        state: "done",
        document: {
          id: output["id"],
          kind: output["kind"] as DocumentKind,
          title: output["title"].slice(0, 120),
        },
      };
    }
    const error = isRecord(output) && typeof output["error"] === "string" ? output["error"] : null;
    return {
      state: "failed",
      message: (error ?? "The document could not be created.").slice(0, 200),
    };
  }
  if (state === "output-error")
    return { state: "failed", message: "The document could not be created." };
  return { state: "working" };
}

export function replyCredits(parts: readonly unknown[]): number | null {
  for (const part of parts) {
    if (isRecord(part) && part["type"] === "data-usage" && isRecord(part["data"])) {
      const credits = part["data"]["credits"];
      if (typeof credits === "number" && Number.isFinite(credits)) return credits;
    }
  }
  return null;
}

export function replyIsFree(parts: readonly unknown[]): boolean {
  return parts.some((part) => isRecord(part) && part["type"] === "data-free");
}

export function replyText(parts: readonly unknown[]): string {
  return parts
    .map((part) =>
      isRecord(part) && part["type"] === "text" && typeof part["text"] === "string"
        ? part["text"]
        : "",
    )
    .filter(Boolean)
    .join("\n\n");
}

// "Make a 6-slide deck about our Q4 results for the board" -> a short title from the first line.
export function titleFromPrompt(text: string): string {
  const line = text.trim().split("\n")[0]?.trim() ?? "";
  const title = line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
  return title || "New chat";
}

export const firstMessageKey = (conversationId: string) => `buildr:agent-first:${conversationId}`;

export function documentUrl(conversationId: string, documentId: string): string {
  return `/api/conversations/${conversationId}/documents/${documentId}`;
}

export const AGENT_SUGGESTIONS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: "Make a slide deck",
    prompt: "Make a 7-slide PowerPoint deck introducing our new product to customers. Product: ",
  },
  {
    label: "Draft a Word report",
    prompt: "Write a Word report with an executive summary, findings and recommendations about ",
  },
  {
    label: "One-page PDF",
    prompt: "Turn these notes into a clear one-page PDF summary:\n\n",
  },
  { label: "Explain simply", prompt: "Explain this simply, with an example: " },
];
