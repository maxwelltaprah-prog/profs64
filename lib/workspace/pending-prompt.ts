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

const TITLE_MAX = 40;

// A short title for a new project, derived from the first line of the prompt without any model
// call (so it works when the assistant is down and costs nothing). Rules, in order:
//   1. "called X" or "named X" wins, because that is what the person calls the thing.
//   2. Otherwise drop the request wrapper ("Build me a", "I want"), cut at the first clause
//      ("," ";" ":" or a word like "with" or "that"), and cap at about 40 characters.
// The result satisfies the project-name schema (no control characters, at most 80 characters).
export function projectNameFromPrompt(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  const cleaned = firstLine
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return "New project";

  const named =
    /\b(?:called|named)\s+["\u201c']?([\p{L}\p{N}][\p{L}\p{N}&'\u2019 .-]{0,30}?)(?=["\u201d']|\s*[,:;.!?]|\s+(?:with|that|which|where|using|and|for|in|so)\b|$)/iu.exec(
      cleaned,
    );
  const candidate = named?.[1]?.trim();
  if (candidate && candidate.length >= 2) return capitalise(candidate.slice(0, TITLE_MAX));

  const stripped = cleaned
    .replace(/^please\s+/i, "")
    .replace(/^(?:can|could|would)\s+you\s+/i, "")
    .replace(/^i\s+(?:want|need|would\s+like|'d\s+like)\s+/i, "")
    .replace(/^you\s+to\s+/i, "")
    .replace(/^(?:build|create|make|design|generate|write|develop|code)\s+/i, "")
    .replace(/^me\s+/i, "")
    .replace(/^(?:an?|the|some)\s+/i, "");
  const clause = stripped.split(/[,;:.!?]/)[0] ?? "";
  const core = (
    clause.split(/\s(?:with|that|which|where|using|including|featuring)\s/i)[0] ?? ""
  ).trim();
  const base = core.length >= 3 ? core : cleaned;
  if (base.length <= TITLE_MAX) return capitalise(base);
  const cut = base.slice(0, TITLE_MAX);
  const stop = cut.lastIndexOf(" ") > TITLE_MAX / 2 ? cut.lastIndexOf(" ") : cut.length;
  return capitalise(
    cut
      .slice(0, stop)
      .replace(/[\s.:;,!?(-]+$/, "")
      .trimEnd() || cut.trimEnd(),
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
