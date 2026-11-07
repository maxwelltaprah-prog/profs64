"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export interface AuthFieldConfig {
  name: string;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  hint?: string;
  /** Checked before submitting so the person gets a specific message instead of a generic one. */
  minLength?: number;
}

interface AuthFormProps {
  endpoint: string;
  fields: readonly AuthFieldConfig[];
  submitLabel: string;
  /** Where to go after success, or undefined to show successMessage instead. */
  redirectTo?: string;
  successTitle?: string;
  successMessage?: string;
}

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

export function AuthForm({
  endpoint,
  fields,
  submitLabel,
  redirectTo,
  successTitle,
  successMessage,
}: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    for (const field of fields) {
      const value = values[field.name] ?? "";
      if (value.trim().length === 0) {
        setError(`Enter your ${field.label.toLowerCase()}.`);
        return;
      }
      if (field.minLength !== undefined && value.length < field.minLength) {
        setError(`${field.label} must be at least ${field.minLength} characters.`);
        return;
      }
    }
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (response.ok) {
        if (redirectTo) {
          // Full navigation so the server renders with the freshly set session cookie.
          window.location.assign(redirectTo);
          return;
        }
        setDone(true);
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Something went wrong. Try again in a moment.");
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="border-hairline bg-accent-subtle rounded-md border p-4">
        <p className="text-sm font-medium">{successTitle}</p>
        <p className="text-muted mt-1 text-[13px]">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {fields.map((field) => (
        <Field
          key={field.name}
          label={field.label}
          name={field.name}
          type={field.type}
          autoComplete={field.autoComplete}
          required
          {...(field.hint ? { hint: field.hint } : {})}
          {...(field.minLength !== undefined ? { minLength: field.minLength } : {})}
          value={values[field.name] ?? ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, [field.name]: event.target.value }))
          }
        />
      ))}
      {error ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle text-text rounded-md border px-3 py-2 text-[13px]"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending}>
        {pending ? "Working…" : submitLabel}
      </Button>
    </form>
  );
}
