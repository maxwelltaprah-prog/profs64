"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createProjectForPrompt } from "@/lib/workspace/open-project";
import { readPendingPrompt } from "@/lib/workspace/pending-prompt";

type State = { kind: "working" } | { kind: "error"; message: string };

// Creates a project from the prompt saved on the home page, then opens its workspace, where
// the chat panel sends the prompt as the first message. Runs once per mount.
export function StartProject() {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<State>({ kind: "working" });

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const pending = readPendingPrompt();
    if (!pending) {
      router.replace("/dashboard");
      return;
    }
    if (pending.projectId) {
      // The project already exists (for example, the page was reloaded). Just open it.
      router.replace(`/project/${pending.projectId}`);
      return;
    }

    const run = async () => {
      const result = await createProjectForPrompt(pending.text);
      if (result.ok) router.replace(`/project/${result.projectId}`);
      else setState({ kind: "error", message: result.message });
    };
    void run();
  }, [router]);

  if (state.kind === "error") {
    return (
      <div role="alert" className="border-hairline bg-surface max-w-md rounded-lg border p-6">
        <p className="text-sm font-medium">Could not start the project</p>
        <p className="text-muted mt-1 text-[13px]">{state.message}</p>
        <p className="text-muted mt-4 text-[13px]">
          Your description is still saved.{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-accent underline underline-offset-2"
          >
            Try again
          </button>{" "}
          or go to{" "}
          <Link href="/dashboard" className="text-accent underline underline-offset-2">
            your projects
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col items-center gap-4 text-center">
      <span aria-hidden="true" className="flex items-center gap-1.5">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </span>
      <div role="status" aria-live="polite" className="flex flex-col gap-1">
        <p className="text-base font-semibold tracking-tight">Creating your project</p>
        <p className="text-muted text-sm">
          Your description is saved. The workspace opens in a moment and the assistant starts from
          it.
        </p>
      </div>
    </div>
  );
}
