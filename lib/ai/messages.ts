import { type UIMessage } from "ai";

// What gets stored for an assistant turn and what is replayed to the model next time.
// - Reasoning text is dropped (it can be long and is not needed again).
// - Tool calls that never finished are dropped, because replaying a call with no result makes
//   providers reject the whole conversation.
// - File contents inside tool results are replaced with a stub; the files themselves live in the
//   project, and replaying them on every turn would multiply the cost.

const MAX_TEXT_CHARS = 20_000;
const STUB = "[contents omitted; read the file again if needed]";

type Part = Record<string, unknown>;

const isRecord = (value: unknown): value is Part => typeof value === "object" && value !== null;

function trimOutput(output: unknown): unknown {
  if (!isRecord(output)) return output;
  const copy: Part = { ...output };
  if (typeof copy["content"] === "string") copy["content"] = STUB;
  if (Array.isArray(copy["files"]) && copy["files"].length > 100)
    copy["files"] = copy["files"].slice(0, 100);
  return copy;
}

export function sanitizeParts(parts: readonly unknown[]): unknown[] {
  const kept: unknown[] = [];
  for (const part of parts) {
    if (!isRecord(part) || typeof part["type"] !== "string") continue;
    const type = part["type"];
    if (type === "text") {
      const text = typeof part["text"] === "string" ? part["text"].slice(0, MAX_TEXT_CHARS) : "";
      if (text.trim().length > 0) kept.push({ type: "text", text });
    } else if (type.startsWith("tool-")) {
      if (part["state"] === "output-available") {
        kept.push({ ...part, output: trimOutput(part["output"]) });
      } else if (part["state"] === "output-error") {
        kept.push(part);
      }
    }
    // step-start and everything else is dropped.
  }
  return kept;
}

export function toUiMessages(
  stored: ReadonlyArray<{ id: string; role: "user" | "assistant"; parts: unknown[] }>,
  limit: number,
): UIMessage[] {
  const recent = stored.slice(-limit);
  // Providers expect the conversation to open with the person, so drop a leading assistant turn.
  const start = recent.findIndex((message) => message.role === "user");
  return recent
    .slice(start === -1 ? recent.length : start)
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: sanitizeParts(message.parts) as UIMessage["parts"],
    }))
    .filter((message) => message.parts.length > 0);
}

export function characterCount(messages: readonly UIMessage[]): number {
  return messages.reduce((total, message) => total + JSON.stringify(message.parts).length, 0);
}
