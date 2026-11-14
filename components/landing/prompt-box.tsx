"use client";

import {
  ArrowUp,
  ChevronDown,
  FileText,
  Folder,
  ListChecks,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";
import { type OAuthProvider } from "@/lib/security/oauth-providers";
import {
  ATTACHMENT_PROBLEM_TEXT,
  checkAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/lib/workspace/attachments";
import { createProjectForPrompt } from "@/lib/workspace/open-project";
import {
  normalisePromptText,
  PLAN_DIRECTIVE,
  savePendingPrompt,
  type PendingAttachment,
  type PromptMode,
} from "@/lib/workspace/pending-prompt";

const START_PATH = "/start";

const EXAMPLES = [
  "A coffee shop with a menu and opening hours",
  "A habit tracker with a weekly grid and streaks",
  "A portfolio with projects and a contact form",
  "An expense log with monthly totals",
];

// The example gallery further down the page fills the box through this event.
export const PICK_EXAMPLE_EVENT = "buildr:pick-example";

type Tab = "signup" | "login";
type ProjectOption = { id: string; name: string };
type PromptAttachment = PendingAttachment & { bytes: number };

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsText(file);
  });
}

// The prompt is the first thing on the page. Signing in is asked for only when the person
// commits, and the prompt is kept so nothing they typed is lost on the way.
export function PromptBox({
  signedIn,
  passwordMin,
  providers = [],
  inputId,
  showExamples = true,
}: {
  signedIn: boolean;
  passwordMin: number;
  /** A fixed id for the text box, so other controls on the page can focus it. */
  inputId?: string;
  /** The example chips under the box; the home screen shows its own start cards instead. */
  showExamples?: boolean;
  /** External sign-in providers switched on in Supabase; none means email and password only. */
  providers?: readonly OAuthProvider[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const textareaId = inputId ?? generatedId;
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("signup");
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [mode, setMode] = useState<PromptMode>("build");
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    const onPick = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== "string") return;
      setText(detail);
      setError(null);
      const box = document.getElementById(textareaId);
      box?.scrollIntoView({ block: "center", behavior: "smooth" });
      box?.focus({ preventScroll: true });
    };
    window.addEventListener(PICK_EXAMPLE_EVENT, onPick);
    return () => window.removeEventListener(PICK_EXAMPLE_EVENT, onPick);
  }, [textareaId]);

  const trimmed = normalisePromptText(text);
  const remaining = CHAT_TEXT_MAX_CHARS - text.length;

  const loadProjects = async () => {
    if (!signedIn || projects !== null || loadingProjects) return;
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) {
        setProjectError("Could not load your projects. Try again.");
        return;
      }
      const data = (await response.json()) as { projects?: ProjectOption[] };
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch {
      setProjectError("Could not load your projects. Check your connection and try again.");
    } finally {
      setLoadingProjects(false);
    }
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;
    setAttachmentError(null);
    const next = [...attachments];
    for (const file of picked) {
      if (next.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
        setAttachmentError(ATTACHMENT_PROBLEM_TEXT.too_many);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError(`${file.name}: ${ATTACHMENT_PROBLEM_TEXT.too_large}`);
        continue;
      }
      try {
        const content = await readTextFile(file);
        const checked = checkAttachment(file.name, content);
        if (!checked.ok) {
          setAttachmentError(`${file.name}: ${ATTACHMENT_PROBLEM_TEXT[checked.problem]}`);
          continue;
        }
        if (next.some((attachment) => attachment.name === file.name)) {
          setAttachmentError(`${file.name}: remove the duplicate file before attaching it again.`);
          continue;
        }
        next.push({ name: file.name, content, bytes: file.size });
      } catch {
        setAttachmentError(`${file.name}: it could not be read.`);
      }
    }
    setAttachments(next);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (trimmed.length === 0) {
      setError("Describe the app you want to build.");
      return;
    }
    if (text.length > CHAT_TEXT_MAX_CHARS) {
      setError(`Keep the description under ${CHAT_TEXT_MAX_CHARS.toLocaleString()} characters.`);
      return;
    }
    if (mode === "plan" && text.length + PLAN_DIRECTIVE.length > CHAT_TEXT_MAX_CHARS) {
      setError("Shorten the description a little to use Plan mode.");
      return;
    }
    setError(null);
    const pendingAttachments = attachments.map(({ name, content }) => ({ name, content }));
    savePendingPrompt(trimmed, selectedProject?.id, pendingAttachments, mode);
    if (signedIn) {
      setLeaving(true);
      void openWorkspace(trimmed, pendingAttachments, selectedProject, mode);
      return;
    }
    dialog.current?.showModal();
    // Start in the first field rather than on the close button.
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
  };

  const close = () => {
    const element = dialog.current;
    if (!element?.open || element.dataset.closing) return;
    element.close();
  };

  // Straight from the prompt to the workspace: create the project here and open it, rather than
  // hopping through the /start screen. /start still handles the email-confirmation path and is the
  // fallback if creation fails here, since it shows the error with a retry.
  const openWorkspace = async (
    prompt: string,
    pendingAttachments: readonly PendingAttachment[] = [],
    project: ProjectOption | null = null,
    promptMode: PromptMode = "build",
  ) => {
    if (project) {
      savePendingPrompt(prompt, project.id, pendingAttachments, promptMode);
      router.push(`/project/${project.id}`);
      return;
    }
    const result = await createProjectForPrompt(prompt, pendingAttachments, promptMode);
    if (result.ok) router.push(`/project/${result.projectId}`);
    else router.push(START_PATH);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  const tabClass = (active: boolean) =>
    `press -mb-px border-b-2 px-3 pb-2 text-[13px] font-medium ${
      active ? "border-accent text-text" : "text-muted hover:text-text border-transparent"
    }`;

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <label htmlFor={textareaId} className="sr-only">
          Describe the app you want to build
        </label>
        <div className="transition-ui border-hairline-strong bg-surface ring-line-focus rounded-2xl border shadow-lg">
          {attachments.length > 0 ? (
            <ul aria-label="Files to attach" className="flex flex-wrap gap-2 px-4 pt-4">
              {attachments.map((attachment) => (
                <li
                  key={attachment.name}
                  className="bg-surface-2 text-muted flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                >
                  <FileText {...iconProps} size={14} className="shrink-0" />
                  <span className="max-w-48 truncate" title={attachment.name}>
                    {attachment.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() =>
                      setAttachments((current) => current.filter((item) => item !== attachment))
                    }
                    className="press text-muted hover:text-text flex size-5 shrink-0 items-center justify-center rounded"
                  >
                    <X {...iconProps} size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <textarea
            id={textareaId}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={CHAT_TEXT_MAX_CHARS + 1}
            placeholder="Describe the app you want to build"
            aria-describedby={
              error ? `${textareaId}-error` : remaining < 500 ? `${textareaId}-hint` : undefined
            }
            aria-invalid={error ? true : undefined}
            className="text-text placeholder:text-subtle block min-h-24 w-full resize-none bg-transparent px-5 pt-4 pb-2 text-base leading-7 focus-visible:outline-none sm:min-h-28"
          />
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <div
                role="group"
                aria-label="Generation mode"
                className="bg-surface-2 flex rounded-lg p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={mode === "build"}
                  onClick={() => setMode("build")}
                  className={`press rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    mode === "build"
                      ? "bg-surface text-text shadow-sm"
                      : "text-muted hover:text-text"
                  }`}
                >
                  Build
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "plan"}
                  onClick={() => setMode("plan")}
                  className={`press inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    mode === "plan"
                      ? "bg-surface text-text shadow-sm"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <ListChecks {...iconProps} size={14} />
                  Plan
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={projectMenuOpen}
                  aria-controls={`${textareaId}-project-options`}
                  onClick={() => {
                    setProjectMenuOpen((open) => !open);
                    void loadProjects();
                  }}
                  className="press border-hairline text-muted hover:text-text inline-flex h-8 max-w-48 items-center gap-1.5 rounded-lg border px-2.5 text-xs"
                >
                  <Folder {...iconProps} size={14} className="shrink-0" />
                  <span className="truncate">{selectedProject?.name ?? "New project"}</span>
                  <ChevronDown {...iconProps} size={13} className="shrink-0" />
                </button>
                <div
                  id={`${textareaId}-project-options`}
                  hidden={!projectMenuOpen}
                  className="glass border-hairline-strong absolute bottom-full left-0 z-20 mb-2 w-64 max-w-[calc(100vw-4rem)] rounded-lg border p-1.5 shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProject(null);
                      setProjectMenuOpen(false);
                    }}
                    className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs"
                  >
                    <Plus {...iconProps} size={14} />
                    New project
                  </button>
                  {loadingProjects ? (
                    <p role="status" className="text-muted px-2.5 py-2 text-xs">
                      Loading projects…
                    </p>
                  ) : null}
                  {projects?.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        setSelectedProject(project);
                        setProjectMenuOpen(false);
                      }}
                      className="text-muted hover:bg-surface-2 hover:text-text flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs"
                    >
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))}
                  {signedIn && projects?.length === 0 ? (
                    <p className="text-subtle px-2.5 py-2 text-xs">No existing projects yet.</p>
                  ) : null}
                  {!signedIn ? (
                    <p className="text-subtle px-2.5 py-2 text-xs">
                      Sign in to choose an existing project.
                    </p>
                  ) : null}
                  {projectError ? (
                    <p role="alert" className="text-danger px-2.5 py-2 text-xs">
                      {projectError}
                    </p>
                  ) : null}
                </div>
              </div>
              <input
                ref={filePicker}
                type="file"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
                accept=".txt,.md,.csv,.json,.css,.html,.ts,.tsx,.js,.jsx,.svg,.xml,.yaml,.yml,.log,text/*"
                onChange={(event) => void addFiles(event)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Attach files"
                title={`Attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} text files, ${MAX_ATTACHMENT_BYTES / 1024} KB each`}
                disabled={attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE}
                onClick={() => filePicker.current?.click()}
              >
                <Paperclip {...iconProps} size={14} />
              </Button>
            </div>
            {remaining < 500 ? (
              <p id={`${textareaId}-hint`} className="text-subtle ml-auto text-xs tabular-nums">
                {remaining} characters left
              </p>
            ) : null}
            <Button
              type="submit"
              size="icon"
              loading={leaving}
              disabled={!trimmed}
              aria-label={signedIn ? "Generate" : "Generate for free"}
              title={signedIn ? "Generate" : "Generate for free"}
              className="ml-auto size-10 rounded-full"
            >
              <ArrowUp {...iconProps} size={19} />
            </Button>
          </div>
        </div>
        {error ? (
          <p
            id={`${textareaId}-error`}
            role="alert"
            className="border-danger bg-danger-subtle text-text rounded-md border px-3 py-2 text-[13px]"
          >
            {error}
          </p>
        ) : null}
        {attachmentError ? (
          <p
            role="alert"
            className="border-danger bg-danger-subtle text-text rounded-md border px-3 py-2 text-[13px]"
          >
            {attachmentError}
          </p>
        ) : null}
        {showExamples ? (
          <div className="flex flex-col items-center gap-2.5">
            <p className="text-subtle text-xs">Need a starting point? Try one of these</p>
            <ul className="flex flex-wrap justify-center gap-2" aria-label="Example prompts">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => {
                      setText(example);
                      setError(null);
                      document.getElementById(textareaId)?.focus();
                    }}
                    className="press border-hairline bg-surface text-muted hover:border-hairline-strong hover:text-text rounded-full border px-3.5 py-1.5 text-xs"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      <dialog
        ref={dialog}
        aria-labelledby={`${textareaId}-dialog-title`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="glass border-hairline-strong text-text m-auto w-[min(420px,calc(100vw-2rem))] rounded-xl border p-0 shadow-[0_24px_64px_rgb(0_0_0/0.28)] backdrop:bg-black/30"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id={`${textareaId}-dialog-title`}
                className="text-lg font-semibold tracking-tight"
              >
                {tab === "signup" ? "Create a free account" : "Sign in to continue"}
              </h2>
              <p className="text-muted mt-1 text-[13px]">
                Your description is saved. You get 20 credits to start.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
              <X {...iconProps} />
            </Button>
          </div>

          <div role="tablist" aria-label="Account" className="border-hairline mt-5 flex border-b">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signup"}
              onClick={() => setTab("signup")}
              className={tabClass(tab === "signup")}
            >
              Create account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "login"}
              onClick={() => setTab("login")}
              className={tabClass(tab === "login")}
            >
              Sign in
            </button>
          </div>

          {providers.length > 0 ? (
            <div className="mt-5 flex flex-col gap-4">
              {/* Back through /start, which creates the project from the saved description. */}
              <ProviderButtons
                providers={providers}
                next={START_PATH}
                verb={tab === "signup" ? "Sign up with" : "Continue with"}
              />
            </div>
          ) : null}
          <div className="mt-5">
            {tab === "signup" ? (
              <AuthForm
                key="signup"
                endpoint="/api/auth/signup"
                submitLabel="Create account"
                pendingLabel="Creating account…"
                successTitle="Check your email"
                successMessage="We sent a confirmation link. Open it on this device and your project will be created from the description you typed."
                extraBody={{ next: START_PATH }}
                fields={[
                  { name: "email", label: "Email", type: "email", autoComplete: "email" },
                  {
                    name: "password",
                    label: "Password",
                    type: "password",
                    autoComplete: "new-password",
                    hint: `At least ${passwordMin} characters. A short phrase of unrelated words works well.`,
                    minLength: passwordMin,
                  },
                ]}
              />
            ) : (
              <AuthForm
                key="login"
                endpoint="/api/auth/login"
                submitLabel="Sign in"
                pendingLabel="Signing in…"
                rememberMethod
                busyAfterSuccess
                successTitle="Opening your workspace"
                successMessage="Creating a project from your description."
                onSuccess={() =>
                  void openWorkspace(
                    trimmed,
                    attachments.map(({ name, content }) => ({ name, content })),
                    null,
                    mode,
                  )
                }
                fields={[
                  { name: "email", label: "Email", type: "email", autoComplete: "email" },
                  {
                    name: "password",
                    label: "Password",
                    type: "password",
                    autoComplete: "current-password",
                  },
                ]}
              />
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
