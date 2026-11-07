import { tool } from "ai";
import { z } from "zod";

import {
  byteLength,
  MAX_FILE_BYTES,
  MAX_FILES_PER_PROJECT,
  validateProjectPath,
} from "@/lib/security/paths";

// What the tools need from storage. The database implementation lives in lib/db/files.ts and
// runs as the signed-in user, so Row Level Security applies on top of the checks below.
export interface FileStore {
  list(): Promise<Array<{ path: string; bytes: number }>>;
  read(path: string): Promise<string | null>;
  /** Creates or replaces. Returns whether the file already existed. */
  write(path: string, content: string): Promise<{ existed: boolean }>;
  remove(path: string): Promise<boolean>;
}

export type ToolOutput = { ok: true; [key: string]: unknown } | { ok: false; error: string };

const PROBLEM_TEXT: Record<string, string> = {
  not_a_string: "The path must be text.",
  empty: "The path is empty.",
  too_long: "The path is too long.",
  absolute: "Use a path relative to the project root, without a leading slash.",
  too_deep: "The path has too many folders (limit 8).",
  empty_segment: "The path has an empty folder name.",
  invalid_segment: 'Paths cannot contain "." or ".." segments.',
  invalid_characters:
    "Paths may only use letters, digits and . _ @ + - in each segment, with forward slashes, and cannot start a name with a dot.",
  extension_not_allowed: "Allowed file types: ts, tsx, js, jsx, json, css, html, md, svg, txt.",
};

const fail = (error: string): ToolOutput => ({ ok: false, error });

function checkPath(input: unknown): { path: string } | { error: ToolOutput } {
  const result = validateProjectPath(input);
  if (!result.ok)
    return { error: fail(PROBLEM_TEXT[result.problem] ?? "That path is not allowed.") };
  return { path: result.path };
}

const pathField = z
  .string()
  .max(300)
  .describe("Relative file path such as src/components/Hero.tsx");
const contentField = z.string().max(MAX_FILE_BYTES * 2);

// Every limit is enforced here in code. The prompt describes them, but nothing depends on the
// model obeying the prompt.
export function createProjectTools(store: FileStore) {
  return {
    list_files: tool({
      description: "List every file in the project with its size in bytes.",
      inputSchema: z.object({}).strict(),
      execute: async (): Promise<ToolOutput> => {
        const files = await store.list();
        return { ok: true, files };
      },
    }),

    read_file: tool({
      description: "Read the full text of one file in the project.",
      inputSchema: z.object({ path: pathField }).strict(),
      execute: async ({ path }): Promise<ToolOutput> => {
        const checked = checkPath(path);
        if ("error" in checked) return checked.error;
        const content = await store.read(checked.path);
        if (content === null) return fail(`No file at ${checked.path}.`);
        return { ok: true, path: checked.path, content };
      },
    }),

    write_file: tool({
      description:
        "Create a file or replace its whole contents. Use edit_file for small changes to an existing file.",
      inputSchema: z.object({ path: pathField, content: contentField }).strict(),
      execute: async ({ path, content }): Promise<ToolOutput> => {
        const checked = checkPath(path);
        if ("error" in checked) return checked.error;
        if (byteLength(content) > MAX_FILE_BYTES) {
          return fail(
            `The file is larger than ${MAX_FILE_BYTES / 1024} KB. Split it into smaller files.`,
          );
        }
        const existing = await store.list();
        const exists = existing.some((file) => file.path === checked.path);
        if (!exists && existing.length >= MAX_FILES_PER_PROJECT) {
          return fail(
            `The project already has ${MAX_FILES_PER_PROJECT} files, which is the limit.`,
          );
        }
        const { existed } = await store.write(checked.path, content);
        return {
          ok: true,
          path: checked.path,
          action: existed ? "updated" : "created",
          bytes: byteLength(content),
        };
      },
    }),

    edit_file: tool({
      description:
        "Replace one exact piece of text in an existing file. old_string must match exactly once, including whitespace.",
      inputSchema: z
        .object({
          path: pathField,
          old_string: z.string().min(1).max(MAX_FILE_BYTES),
          new_string: z.string().max(MAX_FILE_BYTES),
        })
        .strict(),
      execute: async ({ path, old_string, new_string }): Promise<ToolOutput> => {
        const checked = checkPath(path);
        if ("error" in checked) return checked.error;
        const current = await store.read(checked.path);
        if (current === null) return fail(`No file at ${checked.path}.`);

        const first = current.indexOf(old_string);
        if (first === -1)
          return fail("old_string was not found. Read the file again and copy the text exactly.");
        if (current.indexOf(old_string, first + old_string.length) !== -1) {
          return fail(
            "old_string matches more than once. Include more surrounding text so it matches exactly once.",
          );
        }

        // Slice instead of String.replace so "$&" and similar patterns in new_string stay literal.
        const next =
          current.slice(0, first) + new_string + current.slice(first + old_string.length);
        if (byteLength(next) > MAX_FILE_BYTES) {
          return fail(`The edited file would be larger than ${MAX_FILE_BYTES / 1024} KB.`);
        }
        await store.write(checked.path, next);
        return { ok: true, path: checked.path, action: "edited", bytes: byteLength(next) };
      },
    }),

    delete_file: tool({
      description: "Delete one file from the project.",
      inputSchema: z.object({ path: pathField }).strict(),
      execute: async ({ path }): Promise<ToolOutput> => {
        const checked = checkPath(path);
        if ("error" in checked) return checked.error;
        const removed = await store.remove(checked.path);
        if (!removed) return fail(`No file at ${checked.path}.`);
        return { ok: true, path: checked.path, action: "deleted" };
      },
    }),
  };
}

export type ProjectTools = ReturnType<typeof createProjectTools>;
