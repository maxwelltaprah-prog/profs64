"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  projectNameFromPrompt,
  readPendingPrompt,
  savePendingPrompt,
} from "@/lib/workspace/pending-prompt";

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
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: projectNameFromPrompt(pending.text) }),
        });
        const body = (await response.json().catch(() => null)) as {
          project?: { id: string };
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.project?.id) {
          setState({
            kind: "error",
            message: body?.error?.message ?? "Could not create the project. Try again.",
          });
          return;
        }
        savePendingPrompt(pending.text, body.project.id);
        router.replace(`/project/${body.project.id}`);
      } catch {
        setState({
          kind: "error",
          message: "Could not reach the server. Check your connection and try again.",
        });
      }
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
    <p role="status" aria-live="polite" className="text-muted text-sm">
      Creating your project…
    </p>
  );
}
