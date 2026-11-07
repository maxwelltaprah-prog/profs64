// Turns a tool part into the short line shown in the chat. Pure, so it is unit tested. Only the
// path (already validated by the server) and our own fixed error strings are shown, never raw
// tool output.

export interface ToolLine {
  text: string;
  state: "working" | "done" | "failed";
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

  if (part.state === "output-error")
    return {
      text: `Could not finish: ${verb.toLowerCase()} ${pathOf(part.input)}`.trim(),
      state: "failed",
    };

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
    case "write_file":
      return {
        text: `${output["action"] === "updated" ? "Updated" : "Created"} ${path}`,
        state: "done",
      };
    case "edit_file":
      return { text: `Edited ${path}`, state: "done" };
    case "delete_file":
      return { text: `Deleted ${path}`, state: "done" };
    case "read_file":
      return { text: `Read ${path}`, state: "done" };
    default:
      return { text: "Listed project files", state: "done" };
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
    // Not JSON: a network failure or a stream error.
  }
  return "The message could not be sent. Check your connection and try again.";
}
