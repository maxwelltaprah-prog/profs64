// Turns a project's files into something a browser can run without a build step: each TS/TSX
// file is transpiled (no type-checking) and its imports are rewritten so an import map can
// resolve them; project modules become "~/path" entries, CSS is collected, and bare package
// names point at a CDN. Pure and synchronous apart from the transpiler, so it is unit-tested.

import { parse } from "es-module-lexer/js";

import { cdnUrlFor } from "./packages";

// The pure-JS build of the lexer is used so no WebAssembly is needed under the app's CSP.

export interface PreviewBundle {
  /** Module specifier ("~/src/App.tsx") to transpiled JavaScript. */
  modules: Record<string, string>;
  /** Import map for the frame: packages to CDN URLs; project modules are filled in by the frame. */
  imports: Record<string, string>;
  /** Project CSS, in import order. */
  css: string;
  /** Specifier of the entry module, or null when index.html has no module script. */
  entry: string | null;
  /** Problems that stop the preview, with the file they were found in. */
  errors: Array<{ path: string; message: string }>;
}

export type Transpile = (code: string, path: string) => { code: string } | { error: string };

const SCRIPT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const RESOLVE_ORDER = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

export function normalisePath(base: string, specifier: string): string {
  const joined = specifier.startsWith("/")
    ? specifier.slice(1)
    : `${base ? `${base}/` : ""}${specifier}`;
  const out: string[] = [];
  for (const segment of joined.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") out.pop();
    else out.push(segment);
  }
  return out.join("/");
}

function isLocal(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier.startsWith("@/")
  );
}

function localTarget(fromPath: string, specifier: string): string {
  if (specifier.startsWith("@/")) return normalisePath("", `src/${specifier.slice(2)}`);
  return normalisePath(dirname(fromPath), specifier);
}

function resolveLocal(files: ReadonlyMap<string, string>, target: string): string | null {
  for (const suffix of RESOLVE_ORDER) {
    const candidate = `${target}${suffix}`;
    if (files.has(candidate)) return candidate;
  }
  return null;
}

export function entryFromIndexHtml(html: string | undefined): string | null {
  if (!html) return null;
  const match = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i.exec(html);
  if (!match?.[1]) return null;
  return normalisePath("", match[1]);
}

function escapeForJs(text: string): string {
  return JSON.stringify(text);
}

export function buildPreview(
  input: ReadonlyMap<string, string>,
  transpile: Transpile,
): PreviewBundle {
  const files = input;
  const modules: Record<string, string> = {};
  const importMap = new Map<string, string>();
  const cssParts: string[] = [];
  const cssSeen = new Set<string>();
  const errors: PreviewBundle["errors"] = [];

  const entryPath = entryFromIndexHtml(files.get("index.html"));
  if (!entryPath) {
    errors.push({ path: "index.html", message: 'No <script type="module" src> found.' });
  }

  const visited = new Set<string>();
  const queue: string[] = entryPath && files.has(entryPath) ? [entryPath] : [];
  if (entryPath && !files.has(entryPath)) {
    errors.push({ path: "index.html", message: `Entry file ${entryPath} does not exist.` });
  }

  while (queue.length > 0) {
    const path = queue.shift() as string;
    if (visited.has(path)) continue;
    visited.add(path);
    const source = files.get(path) ?? "";

    if (path.endsWith(".css")) {
      if (!cssSeen.has(path)) {
        cssSeen.add(path);
        cssParts.push(source);
      }
      continue;
    }
    if (path.endsWith(".json")) {
      try {
        modules[`~/${path}`] = `export default ${JSON.stringify(JSON.parse(source))};\n`;
      } catch {
        errors.push({ path, message: "Invalid JSON." });
      }
      continue;
    }
    if (path.endsWith(".svg")) {
      const url = `data:image/svg+xml;utf8,${encodeURIComponent(source)}`;
      modules[`~/${path}`] = `export default ${escapeForJs(url)};\n`;
      continue;
    }
    if (!SCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension))) {
      errors.push({ path, message: "This file type cannot be imported in the preview." });
      continue;
    }

    const transpiled = transpile(source, path);
    if ("error" in transpiled) {
      errors.push({ path, message: transpiled.error });
      continue;
    }

    const code = transpiled.code;
    let parsed: ReturnType<typeof parse>[0];
    try {
      parsed = parse(code, path)[0];
    } catch (error) {
      errors.push({ path, message: error instanceof Error ? error.message : "Could not parse." });
      continue;
    }

    // Rewrite from the end so earlier offsets stay valid.
    let rewritten = code;
    for (const entry of [...parsed].reverse()) {
      if (typeof entry.specifier !== "string") continue; // import.meta, non-literal dynamic import
      const specifier = entry.specifier;
      const isDynamic = entry.type === "dynamic";
      const replaceWith = (next: string) => {
        const literal = isDynamic ? JSON.stringify(next) : next;
        rewritten = rewritten.slice(0, entry.start) + literal + rewritten.slice(entry.end);
      };

      if (!isLocal(specifier)) {
        importMap.set(specifier, cdnUrlFor(specifier));
        continue;
      }
      const resolved = resolveLocal(files, localTarget(path, specifier));
      if (!resolved) {
        errors.push({ path, message: `Cannot find ${specifier}.` });
        continue;
      }
      queue.push(resolved);
      if (resolved.endsWith(".css")) {
        // Side-effect import of a stylesheet: remove the whole statement.
        if (!isDynamic) {
          rewritten = rewritten.slice(0, entry.importStart) + rewritten.slice(entry.importEnd);
          // Drop a trailing semicolon left behind by the statement.
          if (rewritten.charAt(entry.importStart) === ";")
            rewritten =
              rewritten.slice(0, entry.importStart) + rewritten.slice(entry.importStart + 1);
        }
        continue;
      }
      replaceWith(`~/${resolved}`);
    }

    modules[`~/${path}`] = rewritten;
  }

  // Inside the sandbox the document URL is the frame's, not "/", so a history-based router
  // would render its 404 page. The shim keeps the project's code unchanged and swaps in the
  // in-memory router for the preview only.
  const router = importMap.get("react-router-dom");
  if (router) {
    modules["~/preview-shims/react-router-dom.js"] =
      `export * from ${JSON.stringify(router)};\nexport { MemoryRouter as BrowserRouter, MemoryRouter as HashRouter } from ${JSON.stringify(router)};\n`;
    importMap.set("react-router-dom", "~/preview-shims/react-router-dom.js");
  }

  return {
    modules,
    imports: Object.fromEntries(importMap),
    css: cssParts.join("\n"),
    entry: entryPath ? `~/${entryPath}` : null,
    errors,
  };
}
