import {
  projectNameFromPrompt,
  savePendingPrompt,
  type PendingAttachment,
  type PromptMode,
} from "./pending-prompt";

export type OpenProjectResult = { ok: true; projectId: string } | { ok: false; message: string };

const NETWORK = "Could not reach the server. Check your connection and try again.";

// Creates a project for a prompt typed on the home page and remembers its id with the prompt, so
// the workspace sends the prompt as the first message and a reload does not create a second one.
export async function createProjectForPrompt(
  text: string,
  attachments: readonly PendingAttachment[] = [],
  mode: PromptMode = "build",
): Promise<OpenProjectResult> {
  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: projectNameFromPrompt(text) }),
    });
    const body = (await response.json().catch(() => null)) as {
      project?: { id: string };
      error?: { message?: string };
    } | null;
    const projectId = body?.project?.id;
    if (!response.ok || !projectId) {
      return {
        ok: false,
        message: body?.error?.message ?? "Could not create the project. Try again.",
      };
    }
    savePendingPrompt(text, projectId, attachments, mode);
    return { ok: true, projectId };
  } catch {
    return { ok: false, message: NETWORK };
  }
}
