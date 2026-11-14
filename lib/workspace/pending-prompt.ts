// A prompt typed on the landing page before the person has an account. It is kept in
// localStorage (not sessionStorage) so it survives the confirmation link opening in a new tab.
// Nothing here is trusted: the text is re-validated by the chat route like any other message,
// and the project id must match before a workspace will send it.

import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";
import { checkAttachment, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/workspace/attachments";

export const PENDING_PROMPT_KEY = "buildr.pendingPrompt";
export const PROJECT_NAME_MAX = 60;

export type PromptMode = "build" | "plan";
export const PLAN_DIRECTIVE =
  "Planning mode: outline an implementation plan only. Do not create or edit project files until I approve.\n\nRequest:\n";

export interface PendingPrompt {
  text: string;
  /** Set once /start has created the project the prompt belongs to. */
  projectId?: string;
  attachments?: PendingAttachment[];
  mode?: PromptMode;
  savedAt: number;
}

export interface PendingAttachment {
  name: string;
  content: string;
}

// Prompts older than this are dropped rather than sent into a project the person has forgotten.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function normalisePromptText(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").trim().slice(0, CHAT_TEXT_MAX_CHARS);
}

export function formatPromptForMode(text: string, mode: PromptMode = "build"): string {
  return mode === "plan" ? `${PLAN_DIRECTIVE}${text}` : text;
}

export function savePendingPrompt(
  raw: string,
  projectId?: string,
  attachments: readonly PendingAttachment[] = [],
  mode: PromptMode = "build",
): PendingPrompt | null {
  const text = normalisePromptText(raw);
  if (text.length === 0) return null;
  const checkedAttachments = attachments.slice(0, MAX_ATTACHMENTS_PER_MESSAGE).filter((file) => {
    return checkAttachment(file.name, file.content).ok;
  });
  const entry: PendingPrompt = {
    text,
    ...(projectId ? { projectId } : {}),
    ...(checkedAttachments.length > 0 ? { attachments: checkedAttachments } : {}),
    ...(mode === "plan" ? { mode } : {}),
    savedAt: Date.now(),
  };
  try {
    storage()?.setItem(PENDING_PROMPT_KEY, JSON.stringify(entry));
  } catch {
    // Storage blocked or full: the prompt simply is not remembered.
  }
  return entry;
}

export function readPendingPrompt(now = Date.now()): PendingPrompt | null {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(PENDING_PROMPT_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as PendingPrompt).text !== "string" ||
      typeof (parsed as PendingPrompt).savedAt !== "number"
    ) {
      clearPendingPrompt();
      return null;
    }
    const entry = parsed as PendingPrompt;
    const text = normalisePromptText(entry.text);
    if (text.length === 0 || now - entry.savedAt > MAX_AGE_MS) {
      clearPendingPrompt();
      return null;
    }
    const projectId = typeof entry.projectId === "string" ? entry.projectId : undefined;
    const mode: PromptMode = entry.mode === "plan" ? "plan" : "build";
    const attachments = Array.isArray(entry.attachments)
      ? entry.attachments
          .filter(
            (file): file is PendingAttachment =>
              typeof file === "object" &&
              file !== null &&
              typeof file.name === "string" &&
              typeof file.content === "string" &&
              checkAttachment(file.name, file.content).ok,
          )
          .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
      : [];
    return {
      text,
      savedAt: entry.savedAt,
      ...(projectId ? { projectId } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(mode === "plan" ? { mode } : {}),
    };
  } catch {
    clearPendingPrompt();
    return null;
  }
}

export function clearPendingPrompt(): void {
  try {
    storage()?.removeItem(PENDING_PROMPT_KEY);
  } catch {
    // Nothing to do.
  }
}

// First line of the prompt, cleaned to satisfy the project-name schema (no control characters,
// at most 80 characters) and cut at a word boundary so the tree and header stay readable.
export function projectNameFromPrompt(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  const cleaned = firstLine
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return "New project";
  if (cleaned.length <= PROJECT_NAME_MAX) return cleaned;
  const cut = cleaned.slice(0, PROJECT_NAME_MAX);
  // Prefer ending at a clause boundary, then at a word boundary, so the name reads as a phrase.
  const half = PROJECT_NAME_MAX / 2;
  const clause = Math.max(
    ...[".", ":", ";", ",", "!", "?", " - ", " ("].map((m) => cut.lastIndexOf(m)),
  );
  const stop =
    clause > half ? clause : cut.lastIndexOf(" ") > half ? cut.lastIndexOf(" ") : cut.length;
  return (
    cut
      .slice(0, stop)
      .replace(/[\s.:;,!?(-]+$/, "")
      .trimEnd() || cut.trimEnd()
  );
}
