// Project file paths come from a model that reads untrusted text, so validation is an
// allowlist of exactly what a path may look like, not a list of known-bad patterns. A path
// is accepted only in its canonical form; nothing is normalized or decoded on the way in.

export const ALLOWED_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "css",
  "html",
  "md",
  "svg",
  "txt",
] as const;
export const MAX_PATH_LENGTH = 255;
export const MAX_PATH_DEPTH = 8;
export const MAX_FILE_BYTES = 200 * 1024;
export const MAX_FILES_PER_PROJECT = 100;

export type PathProblem =
  | "not_a_string"
  | "empty"
  | "too_long"
  | "too_deep"
  | "invalid_characters"
  | "absolute"
  | "empty_segment"
  | "invalid_segment"
  | "extension_not_allowed";

export type PathCheck = { ok: true; path: string } | { ok: false; problem: PathProblem };

// Letters, digits and . _ @ + - only, and a segment may not start with a dot. That single rule
// rejects "..", ".", backslashes, "%" (so every URL-encoded variant), spaces, control characters,
// NUL and every non-ASCII lookalike such as a fullwidth dot or a division slash.
const SEGMENT = /^[A-Za-z0-9_@+-][A-Za-z0-9._@+-]*$/;
const EXTENSIONS = new Set<string>(ALLOWED_EXTENSIONS);

export function validateProjectPath(input: unknown): PathCheck {
  if (typeof input !== "string") return { ok: false, problem: "not_a_string" };
  if (input.length === 0) return { ok: false, problem: "empty" };
  if (input.length > MAX_PATH_LENGTH) return { ok: false, problem: "too_long" };
  if (input.startsWith("/")) return { ok: false, problem: "absolute" };

  const segments = input.split("/");
  if (segments.length > MAX_PATH_DEPTH) return { ok: false, problem: "too_deep" };
  if (segments.some((segment) => segment.length === 0))
    return { ok: false, problem: "empty_segment" };
  if (!segments.every((segment) => SEGMENT.test(segment))) {
    // Distinguish "looks like a drive path or traversal" from plain bad characters only for
    // the error message; both are rejected the same way.
    return {
      ok: false,
      problem: segments.some((s) => s === "." || s === "..")
        ? "invalid_segment"
        : "invalid_characters",
    };
  }

  const last = segments[segments.length - 1] ?? "";
  const dot = last.lastIndexOf(".");
  const extension = dot > 0 ? last.slice(dot + 1).toLowerCase() : "";
  if (!EXTENSIONS.has(extension)) return { ok: false, problem: "extension_not_allowed" };

  return { ok: true, path: input };
}

export function isValidProjectPath(input: unknown): input is string {
  return validateProjectPath(input).ok;
}

export function byteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}
