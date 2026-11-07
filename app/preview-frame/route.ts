import { PREVIEW_TAILWIND } from "@/lib/security/csp";

// The document the live preview iframe loads. It is deliberately not a Next.js page: no
// framework scripts, no nonce, and a policy of its own set by proxy.ts. The parent window
// hands it a bundle (lib/preview/bundle.ts) by postMessage; it turns each module into a blob
// URL, writes an import map, injects the project's CSS through runtime Tailwind, and imports
// the entry module. Everything it reports back is plain data for the panel to show.
//
// Only messages from the embedding app are accepted. The frame is sandboxed without
// allow-same-origin, so even a malicious generated app cannot reach the person's session.

export const dynamic = "force-dynamic";

function frameDocument(parentOrigin: string): string {
  // The script is inline on purpose; the frame's CSP allows it and nothing else on this
  // origin ever renders untrusted markup.
  const bootstrap = `
(() => {
  const PARENT = ${JSON.stringify(parentOrigin)};
  const post = (message) => window.parent.postMessage(message, PARENT);
  const urls = [];

  const report = (level, text) => post({ type: "console", level, text: String(text).slice(0, 2000) });
  for (const level of ["error", "warn"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      report(level, args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : safeJson(a))).join(" "));
      original(...args);
    };
  }
  function safeJson(value) { try { return JSON.stringify(value); } catch { return String(value); } }
  window.addEventListener("error", (event) => post({ type: "error", text: String(event.message || event.error || "Error").slice(0, 2000) }));
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    post({ type: "error", text: String(reason && reason.message ? reason.message : reason).slice(0, 2000) });
  });

  function render(bundle) {
    for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    const imports = Object.assign({}, bundle.imports);
    for (const [name, code] of Object.entries(bundle.modules)) {
      const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      urls.push(url);
      imports[name] = url;
    }
    // A package may be redirected to a project-level shim; resolve that to its blob URL.
    for (const [name, target] of Object.entries(imports)) {
      if (typeof target === "string" && target.startsWith("~/") && imports[target]) imports[name] = imports[target];
    }
    if (bundle.tailwindConfig && window.tailwind) window.tailwind.config = bundle.tailwindConfig;
    const style = document.createElement("style");
    style.setAttribute("type", "text/tailwindcss");
    style.textContent = bundle.css || "";
    document.head.appendChild(style);
    const map = document.createElement("script");
    map.type = "importmap";
    map.textContent = JSON.stringify({ imports });
    document.head.appendChild(map);
    if (!bundle.entry) { post({ type: "rendered" }); return; }
    const entry = document.createElement("script");
    entry.type = "module";
    const target = JSON.stringify(PARENT);
    entry.textContent =
      "import(" + JSON.stringify(bundle.entry) + ")" +
      ".then(() => parent.postMessage({ type: 'rendered' }, " + target + "))" +
      ".catch((e) => parent.postMessage({ type: 'error', text: String(e && e.message ? e.message : e).slice(0, 2000) }, " + target + "));";
    document.head.appendChild(entry);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.origin !== PARENT) return;
    const data = event.data;
    if (data && data.type === "render" && data.bundle && typeof data.bundle === "object") render(data.bundle);
  });
  post({ type: "ready" });
})();
`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Preview</title>
<script src="${PREVIEW_TAILWIND}"></script>
<script>${bootstrap}</script>
</head>
<body>
<div id="root"></div>
</body>
</html>
`;
}

export function GET(request: Request) {
  // The embedding page is always this same deployment, so the request's own origin is the
  // only parent the frame will listen to. A forged Host header only affects the forger's frame.
  const parentOrigin = new URL(request.url).origin;
  return new Response(frameDocument(parentOrigin), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
