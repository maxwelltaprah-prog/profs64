// What the code view needs to know about a file from its path alone: the highlighter language,
// which icon to show, and the class each highlighted token gets.

const LANGUAGES = new Map<string, string>([
  ["tsx", "tsx"],
  ["ts", "typescript"],
  ["jsx", "jsx"],
  ["js", "javascript"],
  ["mjs", "javascript"],
  ["cjs", "javascript"],
  ["json", "json"],
  ["css", "css"],
  ["html", "markup"],
  ["svg", "markup"],
  ["xml", "markup"],
  ["md", "markdown"],
  ["yml", "yaml"],
  ["yaml", "yaml"],
]);

function extension(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function languageFor(path: string): string {
  return LANGUAGES.get(extension(path)) ?? "plain";
}

export type FileKind = "react" | "script" | "json" | "style" | "markup" | "doc" | "image" | "other";

export function fileKind(path: string): FileKind {
  const ext = extension(path);
  if (ext === "tsx" || ext === "jsx") return "react";
  if (["ts", "js", "mjs", "cjs"].includes(ext)) return "script";
  if (ext === "json") return "json";
  if (ext === "css") return "style";
  if (ext === "html" || ext === "xml") return "markup";
  if (ext === "md" || ext === "txt") return "doc";
  if (["svg", "png", "jpg", "jpeg", "gif", "webp", "ico"].includes(ext)) return "image";
  return "other";
}

// Prism gives each token a list of types, most general first. The most specific known one picks
// the colour class; anything unknown is plain text.
const CLASSES = new Map<string, string>([
  ["comment", "tok-com"],
  ["prolog", "tok-com"],
  ["doctype", "tok-com"],
  ["keyword", "tok-kw"],
  ["boolean", "tok-kw"],
  ["null", "tok-kw"],
  ["important", "tok-kw"],
  ["atrule", "tok-kw"],
  ["string", "tok-str"],
  ["template-string", "tok-str"],
  ["char", "tok-str"],
  ["attr-value", "tok-str"],
  ["regex", "tok-str"],
  ["url", "tok-str"],
  ["function", "tok-fn"],
  ["number", "tok-num"],
  ["unit", "tok-num"],
  ["class-name", "tok-type"],
  ["maybe-class-name", "tok-type"],
  ["builtin", "tok-type"],
  ["constant", "tok-type"],
  ["tag", "tok-tag"],
  ["selector", "tok-tag"],
  ["attr-name", "tok-attr"],
  ["property", "tok-attr"],
  ["operator", "tok-op"],
  ["punctuation", "tok-punct"],
]);

export function tokenClass(types: readonly string[]): string | undefined {
  for (let index = types.length - 1; index >= 0; index -= 1) {
    const found = CLASSES.get(types.at(index) ?? "");
    if (found) return found;
  }
  return undefined;
}
