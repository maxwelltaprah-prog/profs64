import { Download, FileText, FileType2, Presentation } from "lucide-react";

import { iconProps } from "@/components/ui/icons";
import { documentUrl, KIND_LABEL, type AgentDocument } from "@/lib/workspace/agent";

const ICON = { pptx: Presentation, docx: FileText, pdf: FileType2 } as const;

export function DocumentCard({
  conversationId,
  document,
}: {
  conversationId: string;
  document: AgentDocument;
}) {
  const Icon = ICON[document.kind];
  return (
    <div className="chat-in border-hairline bg-surface flex max-w-md items-center gap-3 rounded-xl border p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <span className="bg-accent-subtle text-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" title={document.title}>
          {document.title}
        </span>
        <span className="text-muted block text-xs">
          {KIND_LABEL[document.kind]} · .{document.kind}
        </span>
      </span>
      <a
        href={documentUrl(conversationId, document.id)}
        download
        className="press border-hairline-strong bg-surface hover:bg-surface-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium"
      >
        <Download {...iconProps} />
        Download
      </a>
    </div>
  );
}
