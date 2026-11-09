import {
  Braces,
  FileCode2,
  FileImage,
  FileText,
  File as FileIcon,
  Hash,
  Atom,
  Code2,
} from "lucide-react";

import { fileKind } from "@/lib/workspace/code-language";

// One small, consistent icon per kind of file. Colour comes from the syntax palette so React,
// script and style files are told apart at a glance, as in an editor.
export function FileTypeIcon({ path }: { path: string }) {
  const common = {
    size: 15,
    strokeWidth: 1.75,
    "aria-hidden": true as const,
    className: "shrink-0",
  };
  switch (fileKind(path)) {
    case "react":
      return <Atom {...common} className="shrink-0 text-[var(--code-fn)]" />;
    case "script":
      return <FileCode2 {...common} className="shrink-0 text-[var(--code-num)]" />;
    case "json":
      return <Braces {...common} className="shrink-0 text-[var(--code-type)]" />;
    case "style":
      return <Hash {...common} className="shrink-0 text-[var(--code-kw)]" />;
    case "markup":
      return <Code2 {...common} className="shrink-0 text-[var(--code-op)]" />;
    case "image":
      return <FileImage {...common} className="shrink-0 text-[var(--code-str)]" />;
    case "doc":
      return <FileText {...common} className="text-muted shrink-0" />;
    default:
      return <FileIcon {...common} className="text-muted shrink-0" />;
  }
}
