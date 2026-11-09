// Turns a tool part into the short line shown in the chat. Pure, so it is unit tested. Only the
// path (already validated by the server) and our own fixed error strings are shown, never raw
// tool output.

import { isKnownStreamError } from "./stream-errors";

export type ToolAction = "created" | "updated" | "edited" | "deleted" | "read" | "listed";

export interface ToolLine {
  text: string;
  state: "working" | "done" | "failed";
  /** What a finished step did, and to which file; used for the one-line summary of a reply. */
  action?: ToolAction;
  path?: string;
}

interface ToolPartLike {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
}

const WORKING_VERBS = new Map<string, string>([
  ["write_file", "Writing"],
  ["edit_file", "Editing"],
  ["delete_file", "Deleting"],
  ["read_file", "Reading"],
  ["list_files", "Listing files"],
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const pathOf = (value: unknown): string => {
  if (isRecord(value) && typeof value["path"] === "string") return value["path"].slice(0, 200);
  return "";
};

export function describeToolPart(part: ToolPartLike): ToolLine | null {
  if (!part.type.startsWith("tool-")) return null;
  const name = part.type.slice("tool-".length);
  if (!WORKING_VERBS.has(name)) return null;
  const verb = WORKING_VERBS.get(name) ?? "";

  // The input is often incomplete when a write fails midway, so the path may be missing.
  if (part.state === "output-error") {
    const target = pathOf(part.input) || (name === "list_files" ? "" : "a file");
    return { text: `Stopped while ${verb.toLowerCase()} ${target}`.trim(), state: "failed" };
  }

  if (part.state !== "output-available") {
    const target = pathOf(part.input);
    return { text: target ? `${verb} ${target}` : verb, state: "working" };
  }

  const output = isRecord(part.output) ? part.output : {};
  if (output["ok"] === false) {
    const reason =
      typeof output["error"] === "string"
        ? output["error"].slice(0, 160)
        : "The change was not allowed.";
    return { text: `Could not change ${pathOf(part.input) || "file"}. ${reason}`, state: "failed" };
  }

  const path = pathOf(output) || pathOf(part.input);
  switch (name) {
    case "write_file": {
      const updated = output["action"] === "updated";
      return {
        text: `${updated ? "Updated" : "Created"} ${path}`,
        state: "done",
        action: updated ? "updated" : "created",
        path,
      };
    }
    case "edit_file":
      return { text: `Edited ${path}`, state: "done", action: "edited", path };
    case "delete_file":
      return { text: `Deleted ${path}`, state: "done", action: "deleted", path };
    case "read_file":
      return { text: `Read ${path}`, state: "done", action: "read", path };
    default:
      return { text: "Listed project files", state: "done", action: "listed" };
  }
}

// True for tool results that changed the project, so the file tree should refresh.
export function changedFiles(part: ToolPartLike): boolean {
  if (part.state !== "output-available") return false;
  if (!["tool-write_file", "tool-edit_file", "tool-delete_file"].includes(part.type)) return false;
  return isRecord(part.output) && part.output["ok"] === true;
}

// Server errors arrive as the response text of a failed request; show our fixed message only.
export function friendlyChatError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isRecord(parsed) &&
      isRecord(parsed["error"]) &&
      typeof parsed["error"]["message"] === "string"
    ) {
      return parsed["error"]["message"].slice(0, 200);
    }
  } catch {
    // Not JSON: one of the server's fixed stream errors, or a network failure.
  }
  if (isKnownStreamError(raw)) return raw;
  return "The message could not be sent. Check your connection and try again.";
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// "Created 3 files, updated 1 file" for the collapsed view of a reply. Reads and listings are not
// changes, so they are left out unless nothing else happened.
export function summariseSteps(lines: readonly ToolLine[]): string {
  const count = (action: ToolAction) =>
    new Set(lines.filter((line) => line.action === action && line.path).map((line) => line.path))
      .size;
  const parts: string[] = [];
  const created = count("created");
  const updated = count("updated");
  const edited = count("edited");
  const deleted = count("deleted");
  if (created) parts.push(`Created ${plural(created, "file")}`);
  if (updated) parts.push(`${parts.length ? "updated" : "Updated"} ${plural(updated, "file")}`);
  if (edited) parts.push(`${parts.length ? "edited" : "Edited"} ${plural(edited, "file")}`);
  if (deleted) parts.push(`${parts.length ? "deleted" : "Deleted"} ${plural(deleted, "file")}`);
  const failed = lines.filter((line) => line.state === "failed").length;
  if (parts.length === 0) {
    const read = count("read");
    if (read) parts.push(`Read ${plural(read, "file")}`);
  }
  if (failed) parts.push(`${failed} ${failed === 1 ? "step" : "steps"} did not finish`);
  return parts.join(", ");
}

// Files a reply changed, in order and without repeats, for the "open this file" list.
export function changedPaths(lines: readonly ToolLine[]): string[] {
  const seen = new Set<string>();
  for (const line of lines) {
    if (
      line.path &&
      (line.action === "created" || line.action === "updated" || line.action === "edited")
    ) {
      seen.add(line.path);
    }
  }
  return [...seen];
}
