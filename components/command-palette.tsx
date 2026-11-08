"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { iconProps } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils/cn";
import { filterActions, moveActive, type PaletteAction } from "@/lib/workspace/palette";

export interface RunnableAction extends PaletteAction {
  run: () => void;
}

// Cmd+K or Ctrl+K opens a native <dialog>, which gives focus trapping, Escape-to-close and an
// inert background without a dependency. Arrow keys move, Enter runs.
export function CommandPalette({ actions }: { actions: readonly RunnableAction[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [isMac, setIsMac] = useState(false);

  const results = useMemo(() => filterActions(actions, query), [actions, query]);

  useEffect(() => {
    // Platform is only known in the browser; render "Ctrl" on the server and switch after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/mac|iphone|ipad/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      input.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const run = (action: RunnableAction | undefined) => {
    if (!action) return;
    close();
    action.run();
  };

  const activeId = results[active] ? `${listId}-${results[active].id}` : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press border-hairline-strong bg-surface text-muted hover:bg-surface-2 hover:text-text flex h-8 items-center gap-2 rounded-md border px-2.5 text-[13px]"
      >
        <Search {...iconProps} />
        <span className="hidden sm:inline">Search</span>
        <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
        <span className="sr-only">Open command palette</span>
      </button>

      <dialog
        ref={dialog}
        aria-label="Command palette"
        data-instant
        onClose={close}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="glass border-hairline-strong text-text m-auto mt-[15vh] w-[min(560px,calc(100vw-2rem))] rounded-xl border p-0 shadow-[0_24px_64px_rgb(0_0_0/0.28)] backdrop:bg-black/30"
      >
        <div className="border-hairline flex items-center gap-2 border-b px-3">
          <Search {...iconProps} className="text-muted" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
            placeholder="Type a command"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((current) => moveActive(current, 1, results.length));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) => moveActive(current, -1, results.length));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(results[active]);
              }
            }}
            className="text-text placeholder:text-subtle h-11 flex-1 bg-transparent text-sm focus-visible:outline-none"
          />
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label="Commands"
          className="max-h-72 overflow-y-auto p-1"
        >
          {results.length === 0 ? (
            <li role="presentation" className="text-muted px-3 py-6 text-center text-[13px]">
              No command matches &ldquo;{query}&rdquo;.
            </li>
          ) : (
            results.map((action, index) => (
              <li
                key={action.id}
                id={`${listId}-${action.id}`}
                role="option"
                aria-selected={index === active}
                onMouseMove={() => setActive(index)}
                onClick={() => run(action)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm",
                  index === active ? "bg-surface-2 text-text" : "text-muted",
                )}
              >
                <span>{action.label}</span>
                {action.hint ? <span className="text-subtle text-xs">{action.hint}</span> : null}
              </li>
            ))
          )}
        </ul>
      </dialog>
    </>
  );
}
