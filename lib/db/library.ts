import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./supabase-server";

export interface LibraryItem {
  id: string;
  title: string;
  updatedAt: string;
  pinned: boolean;
}

export interface Library {
  projects: LibraryItem[];
  chats: LibraryItem[];
  /** False when the organize/share migration has not been applied yet, so pins are unavailable. */
  pinsEnabled: boolean;
}

interface Row {
  id: string;
  title: string;
  updated_at: string;
  pinned_at?: string | null;
}

// Reads all of a person's projects or conversations for the organize page. The title column is
// aliased to `title` so projects (name) and conversations (title) read the same. pinned_at only
// exists after the organize migration; if selecting it fails the query is retried without it and
// pins are reported unavailable, so nothing breaks before the migration is applied.
async function readAll(
  client: SupabaseClient,
  table: "projects" | "conversations",
  titleColumn: "name" | "title",
): Promise<{ items: LibraryItem[]; pinned: boolean }> {
  const title = titleColumn === "title" ? "title" : `title:${titleColumn}`;
  const withPins = await client
    .from(table)
    .select(`id, ${title}, updated_at, pinned_at`)
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!withPins.error && withPins.data) {
    return {
      pinned: true,
      items: (withPins.data as unknown as Row[]).map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updated_at,
        pinned: Boolean(row.pinned_at),
      })),
    };
  }
  const plain = await client
    .from(table)
    .select(`id, ${title}, updated_at`)
    .order("updated_at", { ascending: false })
    .limit(200);
  const items = ((plain.data as unknown as Row[] | null) ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    pinned: false,
  }));
  return { items, pinned: false };
}

export async function loadLibrary(supabase?: SupabaseClient): Promise<Library> {
  const client = supabase ?? (await createSupabaseServerClient());
  const [projects, chats] = await Promise.all([
    readAll(client, "projects", "name"),
    readAll(client, "conversations", "title").catch(() => ({ items: [], pinned: false })),
  ]);
  return { projects: projects.items, chats: chats.items, pinsEnabled: projects.pinned };
}
