"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { LastUsed } from "@/components/auth/last-used";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { iconProps } from "@/components/ui/icons";
import { saveLastAuth } from "@/lib/workspace/last-auth";

export interface AuthFieldConfig {
  name: string;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  hint?: string;
  /** Checked before submitting so the person gets a specific message instead of a generic one. */
  minLength?: number;
  placeholder?: string;
}

interface AuthFormProps {
  endpoint: string;
  fields: readonly AuthFieldConfig[];
  submitLabel: string;
  /** Where to go after success, or undefined to show successMessage instead. */
  redirectTo?: string;
  successTitle?: string;
  successMessage?: string;
  /** Extra fields sent with the form values, such as a post-confirmation path. */
  extraBody?: Readonly<Record<string, string>>;
  /** Called after a successful response when there is no redirectTo. */
  onSuccess?: () => void;
  /** Note this form as the sign-in method used, and mark it next time. */
  rememberMethod?: boolean;
  /** Button text while the request runs and while the next page loads. */
  pendingLabel?: string;
  /** Shown with a progress indicator after success, while onSuccess does more work. */
  busyAfterSuccess?: boolean;
}

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

export function AuthForm({
  endpoint,
  fields,
  submitLabel,
  redirectTo,
  successTitle,
  successMessage,
  extraBody,
  onSuccess,
  rememberMethod = false,
  pendingLabel = "Working…",
  busyAfterSuccess = false,
}: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const form = useRef<HTMLFormElement>(null);

  const reject = (name: string, message: string) => {
    setError(message);
    form.current?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    for (const field of fields) {
      const value = values[field.name] ?? "";
      if (value.trim().length === 0) {
        reject(field.name, `Enter your ${field.label.toLowerCase()}.`);
        return;
      }
      if (field.minLength !== undefined && value.length < field.minLength) {
        reject(field.name, `${field.label} must be at least ${field.minLength} characters.`);
        return;
      }
    }
    setPending(true);
    let leaving = false;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...extraBody, ...values }),
      });
      if (response.ok) {
        if (rememberMethod) saveLastAuth("email");
        if (redirectTo) {
          // Full navigation so the server renders with the freshly set session cookie. The button
          // stays in its pending state until the next page replaces this one, so it never flickers
          // back to its idle label in between.
          leaving = true;
          window.location.assign(redirectTo);
          return;
        }
        setDone(true);
        onSuccess?.();
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Something went wrong. Try again in a moment.");
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      if (!leaving) setPending(false);
    }
  };

  if (done) {
    return (
      <div
        role="status"
        className="rise border-hairline bg-accent-subtle flex items-start gap-3 rounded-lg border p-4"
      >
        {busyAfterSuccess ? (
          <span aria-hidden="true" className="mt-1.5 flex shrink-0 items-center gap-1">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
          </span>
        ) : null}
        <div>
          <p className="text-sm font-medium">{successTitle}</p>
          <p className="text-muted mt-1 text-[13px]">{successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {fields.map((field) => {
        const isPassword = field.type === "password";
        const visible = shown[field.name] === true;
        return (
          <Field
            key={field.name}
            label={field.label}
            name={field.name}
            type={isPassword && visible ? "text" : field.type}
            autoComplete={field.autoComplete}
            required
            {...(field.placeholder ? { placeholder: field.placeholder } : {})}
            inputClassName="h-11 rounded-lg"
            {...(field.hint ? { hint: field.hint } : {})}
            {...(field.minLength !== undefined ? { minLength: field.minLength } : {})}
            {...(isPassword
              ? {
                  trailing: (
                    <button
                      type="button"
                      aria-label={visible ? "Hide password" : "Show password"}
                      aria-pressed={visible}
                      onClick={() =>
                        setShown((current) => ({ ...current, [field.name]: !visible }))
                      }
                      className="press text-muted hover:text-text inline-flex size-9 items-center justify-center rounded-md"
                    >
                      {visible ? <EyeOff {...iconProps} /> : <Eye {...iconProps} />}
                    </button>
                  ),
                }
              : {})}
            value={values[field.name] ?? ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.name]: event.target.value }))
            }
          />
        );
      })}
      {error ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle text-text rounded-md border px-3 py-2 text-[13px]"
        >
          {error}
        </p>
      ) : null}
      <div className="relative">
        <Button
          type="submit"
          size="lg"
          loading={pending}
          className="w-full justify-center rounded-lg"
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
        {rememberMethod ? <LastUsed method="email" /> : null}
      </div>
    </form>
  );
}
