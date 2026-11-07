"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DELETE_CONFIRMATION } from "@/lib/security/schemas";

export function DeleteAccount() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      if (response.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Could not delete the account. Try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-4">
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Field
        label={`Type "${DELETE_CONFIRMATION}" to confirm`}
        name="confirm"
        autoComplete="off"
        required
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      {error ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle rounded-md border px-3 py-2 text-[13px]"
        >
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="danger"
          loading={pending}
          disabled={confirm !== DELETE_CONFIRMATION || password.length === 0}
        >
          Delete account
        </Button>
      </div>
    </form>
  );
}
