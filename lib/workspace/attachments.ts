// Attachments are text files the person adds to a message. They are stored as ordinary project
// files under attachments/, so every existing rule (path allowlist, size cap, file-count cap,
// row level security) applies to them, and the assistant reads them with its normal read tool as
// untrusted data. Zod-free on purpose: the browser imports this too.

import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, validateProjectPath } from "@/lib/security/paths";

export const ATTACHMENT_DIR = "attachments";
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
export const MAX_ATTACHMENT_BYTES = 100 * 1024;
// Appended to a message so the person and the assistant can both see what was attached.
export const ATTACHMENT_MARKER = "Attached: ";

const EXTENSIONS = new Set<string>(ALLOWED_EXTENSIONS);
const MAX_BASENAME = 80;

const isNameChar = (code: number) =>
  (code >= 48 && code <= 57) || // 0-9
  (code >= 65 && code <= 90) || // A-Z
  (code >= 97 && code <= 122) || // a-z
  code === 46 || // .
  code === 45 || // -
  code === 95; // _

// "Q3 Report (final).CSV" becomes "attachments/Q3-Report-final-.CSV.txt": characters outside the
// path allowlist turn into "-", a leading dot is dropped, and a type the project cannot store
// (csv, log, yaml, xml ...) is kept as text by adding .txt. Returns null if nothing usable is left.
export function attachmentPath(fileName: string): string | null {
  let base = "";
  for (const char of fileName.normalize("NFKC")) {
    const next = isNameChar(char.charCodeAt(0)) && char.length === 1 ? char : "-";
    if (next !== "-" || !base.endsWith("-")) base += next;
  }
  while (base.startsWith(".") || base.startsWith("-")) base = base.slice(1);
  if (base.length === 0) return null;

  const dot = base.lastIndexOf(".");
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  const keepsType = EXTENSIONS.has(extension);
  if (base.length > MAX_BASENAME) {
    const kept = keepsType ? `.${extension}` : "";
    base = base.slice(0, MAX_BASENAME - kept.length) + kept;
  }
  if (!EXTENSIONS.has(base.slice(base.lastIndexOf(".") + 1).toLowerCase()) || !base.includes(".")) {
    base += ".txt";
  }
  const check = validateProjectPath(`${ATTACHMENT_DIR}/${base}`);
  return check.ok ? check.path : null;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

// A text attachment must be valid text: a NUL byte or the Unicode replacement character left by
// decoding means the file is binary (an image, a PDF, an archive) and cannot be used here.
export function looksBinary(text: string): boolean {
  return text.includes("\u0000") || text.includes("�");
}

export type AttachmentProblem = "too_many" | "too_large" | "not_text" | "bad_name" | "empty";

export function checkAttachment(
  name: string,
  content: string,
): { ok: true; path: string } | { ok: false; problem: AttachmentProblem } {
  const path = attachmentPath(name);
  if (!path) return { ok: false, problem: "bad_name" };
  if (content.trim().length === 0) return { ok: false, problem: "empty" };
  if (looksBinary(content)) return { ok: false, problem: "not_text" };
  if (utf8Bytes(content) > Math.min(MAX_ATTACHMENT_BYTES, MAX_FILE_BYTES)) {
    return { ok: false, problem: "too_large" };
  }
  return { ok: true, path };
}

export const ATTACHMENT_PROBLEM_TEXT: Record<AttachmentProblem, string> = {
  too_many: `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files to one message.`,
  too_large: `Files must be under ${MAX_ATTACHMENT_BYTES / 1024} KB.`,
  not_text: "Only text files work here: notes, Markdown, CSV, JSON or code.",
  bad_name: "That file name cannot be used. Rename it and try again.",
  empty: "That file is empty.",
};

// "text\n\nAttached: attachments/a.md, attachments/b.txt" -> the text and the paths.
export function splitAttachmentMarker(text: string): { text: string; paths: string[] } {
  const index = text.lastIndexOf(`\n\n${ATTACHMENT_MARKER}`);
  if (index === -1) return { text, paths: [] };
  const tail = text.slice(index + 2 + ATTACHMENT_MARKER.length);
  const paths = tail
    .split(", ")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${ATTACHMENT_DIR}/`) && validateProjectPath(entry).ok);
  if (paths.length === 0 || paths.length > MAX_ATTACHMENTS_PER_MESSAGE) return { text, paths: [] };
  return { text: text.slice(0, index), paths };
}

export function withAttachmentMarker(text: string, paths: readonly string[]): string {
  return paths.length === 0 ? text : `${text}\n\n${ATTACHMENT_MARKER}${paths.join(", ")}`;
}
