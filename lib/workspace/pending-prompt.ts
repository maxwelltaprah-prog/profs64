// A prompt typed on the landing page before the person has an account. It is kept in
// localStorage (not sessionStorage) so it survives the confirmation link opening in a new tab.
// Nothing here is trusted: the text is re-validated by the chat route like any other message,
// and the project id must match before a workspace will send it.

import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";

export const PENDING_PROMPT_KEY = "buildr.pendingPrompt";
export const PROJECT_NAME_MAX = 60;

export interface PendingPrompt {
  text: string;
  /** Set once /start has created the project the prompt belongs to. */
  projectId?: string;
  savedAt: number;
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

export function savePendingPrompt(raw: string, projectId?: string): PendingPrompt | null {
  const text = normalisePromptText(raw);
  if (text.length === 0) return null;
  const entry: PendingPrompt = {
    text,
    ...(projectId ? { projectId } : {}),
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
    return { text, savedAt: entry.savedAt, ...(projectId ? { projectId } : {}) };
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
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > PROJECT_NAME_MAX / 2 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
