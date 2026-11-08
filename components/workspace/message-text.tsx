import { type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { parseBlocks, type Inline } from "@/lib/workspace/message-text";

function Runs({ runs }: { runs: Inline[] }) {
  return runs.map((run, index) => {
    if (run.kind === "strong") return <strong key={index}>{run.text}</strong>;
    if (run.kind === "code") {
      return (
        <code
          key={index}
          className="bg-surface-2 text-text rounded-sm px-1 py-0.5 font-mono text-[0.85em] break-words"
        >
          {run.text}
        </code>
      );
    }
    return run.text;
  });
}

// Renders the assistant's text. Every piece is a React text node: no HTML from the model ever
// reaches the DOM. Blocks that appear while the reply streams fade in, and the last one carries
// a soft caret until the text part is finished.
export function MessageText({
  text,
  streaming = false,
  animate = false,
}: {
  text: string;
  streaming?: boolean;
  animate?: boolean;
}) {
  const blocks = parseBlocks(text, streaming);
  const enter = animate ? "chat-in" : undefined;
  const caret: ReactNode = streaming ? <span className="stream-caret" aria-hidden="true" /> : null;

  return (
    <div className="flex min-w-0 flex-col gap-3 [overflow-wrap:anywhere]">
      {blocks.map((block, index) => {
        const last = index === blocks.length - 1;
        switch (block.kind) {
          case "heading":
            return (
              <p key={index} className={cn("text-text font-semibold", enter)}>
                <Runs runs={block.inline} />
                {last ? caret : null}
              </p>
            );
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List
                key={index}
                className={cn(
                  "flex flex-col gap-1.5 pl-5",
                  block.ordered ? "list-decimal" : "list-disc",
                  "marker:text-subtle",
                  enter,
                )}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="pl-1">
                    <Runs runs={item} />
                    {last && itemIndex === block.items.length - 1 ? caret : null}
                  </li>
                ))}
              </List>
            );
          }
          case "code":
            return (
              <pre
                key={index}
                className={cn(
                  "bg-surface-2 ring-line overflow-x-auto rounded-md p-3 font-mono text-xs leading-5",
                  enter,
                )}
              >
                <code>{block.text}</code>
                {last ? caret : null}
              </pre>
            );
          default:
            return (
              <p key={index} className={cn("whitespace-pre-wrap", enter)}>
                <Runs runs={block.inline} />
                {last ? caret : null}
              </p>
            );
        }
      })}
    </div>
  );
}
