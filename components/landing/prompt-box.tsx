"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";
import { normalisePromptText, savePendingPrompt } from "@/lib/workspace/pending-prompt";

const START_PATH = "/start";

const EXAMPLES = [
  "A landing page for a coffee shop with a menu and opening hours",
  "A habit tracker with a weekly grid and streak counter",
  "A portfolio site with a projects grid and a contact form",
  "An internal tool to log expenses with a monthly total",
];

// The example gallery further down the page fills the box through this event.
export const PICK_EXAMPLE_EVENT = "buildr:pick-example";

type Tab = "signup" | "login";

// The prompt is the first thing on the page. Signing in is asked for only when the person
// commits, and the prompt is kept so nothing they typed is lost on the way.
export function PromptBox({ signedIn, passwordMin }: { signedIn: boolean; passwordMin: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const textareaId = useId();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("signup");
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Platform is only known in the browser; render "Ctrl" on the server and switch after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/mac|iphone|ipad/i.test(navigator.userAgent));
  }, []);

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
    setError(null);
    savePendingPrompt(trimmed);
    if (signedIn) {
      setLeaving(true);
      router.push(START_PATH);
      return;
    }
    dialog.current?.showModal();
  };

  const close = () => dialog.current?.close();

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
        <div className="transition-ui bg-surface ring-line ring-line-focus rounded-xl">
          <textarea
            id={textareaId}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            rows={4}
            maxLength={CHAT_TEXT_MAX_CHARS + 1}
            placeholder="Describe the app you want to build"
            aria-describedby={error ? `${textareaId}-error` : `${textareaId}-hint`}
            aria-invalid={error ? true : undefined}
            className="text-text placeholder:text-subtle block w-full resize-none bg-transparent px-5 pt-5 pb-2 text-lg leading-7 focus-visible:outline-none"
          />
          <div className="flex items-center justify-between gap-3 px-4 pb-4">
            <div className="flex items-center gap-3">
              <span className="border-hairline text-muted rounded-md border px-2 py-1 font-mono text-xs">
                Vite, React, Tailwind
              </span>
              <p
                id={`${textareaId}-hint`}
                className="text-subtle hidden text-xs tabular-nums sm:block"
              >
                {remaining < 500
                  ? `${remaining} characters left`
                  : `${isMac ? "⌘" : "Ctrl"} Enter to generate`}
              </p>
            </div>
            <Button type="submit" loading={leaving}>
              {signedIn ? "Generate" : "Generate for free"}
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
                className="press border-hairline bg-surface text-muted hover:border-hairline-strong hover:text-text rounded-full border px-3 py-1 text-xs"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </form>

      <dialog
        ref={dialog}
        aria-labelledby={`${textareaId}-dialog-title`}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="border-hairline-strong bg-surface text-text m-auto w-[min(420px,calc(100vw-2rem))] rounded-lg border p-0 shadow-md backdrop:bg-black/40"
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

          <div className="mt-5">
            {tab === "signup" ? (
              <AuthForm
                key="signup"
                endpoint="/api/auth/signup"
                submitLabel="Create account"
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
                redirectTo={START_PATH}
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
