import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { AppError, notFound } from "@/lib/security/errors";
import { logger } from "@/lib/security/logger";
import { STARTER_FILES } from "@/lib/templates/vite-react-starter";

import { createSupabaseServerClient } from "./supabase-server";

// Every query here runs as the signed-in user, so Row Level Security is what enforces
// ownership. A project that belongs to someone else is indistinguishable from one that does
// not exist: both return notFound().

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ProjectFile {
  path: string;
  content: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
  createdAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);

// Postgres errors from the cap triggers carry a fixed message; turn them into plain copy.
export function translateDbError(error: { message?: string; code?: string } | null): AppError {
  const message = error?.message ?? "";
  if (message.includes("project limit reached")) {
    return new AppError(
      409,
      "project_limit",
      "You have reached the limit of 50 projects. Delete one to create another.",
    );
  }
  if (message.includes("project file limit reached")) {
    return new AppError(409, "file_limit", "This project has reached the limit of 100 files.");
  }
  if (message.includes("conversation limit reached")) {
    return new AppError(
      409,
      "conversation_limit",
      "This conversation is full. Start a new project to continue.",
    );
  }
  return new AppError(500, "internal", "Something went wrong. Try again in a moment.");
}

export async function listProjects(supabase?: SupabaseClient): Promise<ProjectSummary[]> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("projects")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw translateDbError(error);
  return data.map((row: { id: string; name: string; updated_at: string }) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  }));
}

export async function getProject(id: string, supabase?: SupabaseClient): Promise<ProjectSummary> {
  if (!isUuid(id)) throw notFound();
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("projects")
    .select("id, name, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw translateDbError(error);
  if (!data) throw notFound();
  const row = data as { id: string; name: string; updated_at: string };
  return { id: row.id, name: row.name, updatedAt: row.updated_at };
}

export async function listProjectFiles(
  projectId: string,
  supabase?: SupabaseClient,
): Promise<ProjectFile[]> {
  if (!isUuid(projectId)) throw notFound();
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId)
    .order("path", { ascending: true })
    .limit(100);
  if (error) throw translateDbError(error);
  return data as ProjectFile[];
}

export async function listMessages(
  projectId: string,
  supabase?: SupabaseClient,
): Promise<StoredMessage[]> {
  if (!isUuid(projectId)) throw notFound();
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("messages")
    .select("id, role, parts, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw translateDbError(error);
  return (
    data as Array<{ id: string; role: "user" | "assistant"; parts: unknown[]; created_at: string }>
  ).map((row) => ({ id: row.id, role: row.role, parts: row.parts, createdAt: row.created_at }));
}

// Creates the project and its starter files. PostgREST has no multi-statement transaction, so
// if seeding fails the empty project is removed again rather than left half-built.
export async function createProject(
  ownerId: string,
  name: string,
  supabase?: SupabaseClient,
): Promise<ProjectSummary> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("projects")
    .insert({ owner_id: ownerId, name })
    .select("id, name, updated_at")
    .single();
  if (error) throw translateDbError(error);
  const project = data as { id: string; name: string; updated_at: string };

  const { error: seedError } = await client.from("project_files").insert(
    STARTER_FILES.map((file) => ({
      project_id: project.id,
      path: file.path,
      content: file.content,
    })),
  );
  if (seedError) {
    const { error: cleanupError } = await client.from("projects").delete().eq("id", project.id);
    if (cleanupError) logger.error("project_seed_cleanup_failed", { projectId: project.id });
    throw translateDbError(seedError);
  }
  return { id: project.id, name: project.name, updatedAt: project.updated_at };
}

export async function getCreditBalance(userId: string, supabase?: SupabaseClient): Promise<number> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("profiles")
    .select("credit_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw translateDbError(error);
  return data ? Number((data as { credit_balance: string | number }).credit_balance) : 0;
}
