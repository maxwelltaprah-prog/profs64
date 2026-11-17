import { type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/security/errors";

import { translateDbError } from "./projects";
import { createSupabaseServerClient } from "./supabase-server";

export const COLLECTION = /^[a-z0-9_-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_RECORD_BYTES = 16 * 1024;
export const LIST_LIMIT = 500;

// A plain object with short keys, small enough for the table's own 16 KB check.
export const recordBodySchema = z
  .record(z.string().max(60), z.unknown())
  .refine((value) => new TextEncoder().encode(JSON.stringify(value)).length <= MAX_RECORD_BYTES, {
    message: "Record too large",
  });

export interface DataRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface Row {
  id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// The stored object first, then the three fields the store owns, so a record cannot fake its id.
const shape = (row: Row): DataRecord => ({
  ...row.data,
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function checkCollection(collection: string): string {
  if (!COLLECTION.test(collection)) throw new AppError(400, "invalid_collection", "Invalid name.");
  return collection;
}

export function checkRecordId(id: string): string {
  if (!UUID.test(id)) throw new AppError(404, "not_found", "Not found.");
  return id;
}

// Row level security limits every call here to the signed-in owner's projects. A write to someone
// else's project is refused by policy, and reads of it come back empty; routes also confirm the
// project exists for the caller first.
export async function listRecords(
  projectId: string,
  collection: string,
  supabase?: SupabaseClient,
): Promise<DataRecord[]> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("project_records")
    .select("id, data, created_at, updated_at")
    .eq("project_id", projectId)
    .eq("collection", collection)
    .order("created_at", { ascending: true })
    .limit(LIST_LIMIT);
  if (error) throw translateDbError(error);
  return (data as Row[]).map(shape);
}

export async function createRecord(
  projectId: string,
  collection: string,
  value: Record<string, unknown>,
  supabase?: SupabaseClient,
): Promise<DataRecord> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("project_records")
    .insert({ project_id: projectId, collection, data: value })
    .select("id, data, created_at, updated_at")
    .single();
  if (error || !data) throw translateDbError(error);
  return shape(data as Row);
}

export async function updateRecord(
  projectId: string,
  collection: string,
  recordId: string,
  value: Record<string, unknown>,
  supabase?: SupabaseClient,
): Promise<DataRecord> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data: current, error: readError } = await client
    .from("project_records")
    .select("id, data, created_at, updated_at")
    .eq("id", recordId)
    .eq("project_id", projectId)
    .eq("collection", collection)
    .maybeSingle();
  if (readError) throw translateDbError(readError);
  if (!current) throw new AppError(404, "not_found", "Not found.");
  // A partial update merges into the stored object; the merged result is size-checked by the DB.
  const merged = { ...(current as Row).data, ...value };
  const { data, error } = await client
    .from("project_records")
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq("id", recordId)
    .eq("project_id", projectId)
    .select("id, data, created_at, updated_at")
    .maybeSingle();
  if (error) throw translateDbError(error);
  if (!data) throw new AppError(404, "not_found", "Not found.");
  return shape(data as Row);
}

export async function deleteRecord(
  projectId: string,
  collection: string,
  recordId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { error } = await client
    .from("project_records")
    .delete()
    .eq("id", recordId)
    .eq("project_id", projectId)
    .eq("collection", collection);
  if (error) throw translateDbError(error);
}
