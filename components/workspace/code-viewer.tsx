// Read-only. File content is rendered as text nodes only, never as HTML.
export function CodeViewer({ path, content }: { path: string | null; content: string | null }) {
  if (path === null || content === null) {
    return <p className="text-muted p-4 text-[13px]">Select a file to view it.</p>;
  }
  const lines = content.split("\n");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-hairline text-muted border-b px-4 py-2 font-mono text-xs">{path}</div>
      <div
        className="min-h-0 flex-1 overflow-auto"
        tabIndex={0}
        role="region"
        aria-label={`Contents of ${path}`}
      >
        <pre className="min-w-max p-0 font-mono text-[13px] leading-5">
          {lines.map((line, index) => (
            <div key={index} className="flex">
              <span
                aria-hidden="true"
                className="text-subtle w-12 shrink-0 pr-3 text-right tabular-nums select-none"
              >
                {index + 1}
              </span>
              <code className="pr-4 whitespace-pre">{line === "" ? " " : line}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
