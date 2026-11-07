"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { iconProps } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

export function CreateProject() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as {
        project?: { id: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.project) {
        toast(body?.error?.message ?? "Could not create the project. Try again.", "error");
        return;
      }
      router.push(`/project/${body.project.id}`);
    } catch {
      toast("Could not reach the server. Check your connection and try again.", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex w-full max-w-md items-center gap-2">
      <Input
        aria-label="Project name"
        placeholder="Project name"
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="off"
      />
      <Button type="submit" loading={pending} disabled={name.trim().length === 0}>
        <Plus {...iconProps} />
        Create
      </Button>
    </form>
  );
}
