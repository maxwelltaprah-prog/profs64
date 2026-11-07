import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { type FileStore } from "@/lib/ai/tools";
import { byteLength } from "@/lib/security/paths";

import { translateDbError } from "./projects";

// Stores project files as the signed-in user. The project must already have been checked for
// ownership; RLS repeats that check on every statement.
export function createDbFileStore(supabase: SupabaseClient, projectId: string): FileStore {
  return {
    async list() {
      const { data, error } = await supabase
        .from("project_files")
        .select("path, content")
        .eq("project_id", projectId)
        .order("path")
        .limit(100);
      if (error) throw translateDbError(error);
      return (data as Array<{ path: string; content: string }>).map((row) => ({
        path: row.path,
        bytes: byteLength(row.content),
      }));
    },

    async read(path) {
      const { data, error } = await supabase
        .from("project_files")
        .select("content")
        .eq("project_id", projectId)
        .eq("path", path)
        .maybeSingle();
      if (error) throw translateDbError(error);
      return data ? (data as { content: string }).content : null;
    },

    async write(path, content) {
      const { data: existing, error: readError } = await supabase
        .from("project_files")
        .select("id")
        .eq("project_id", projectId)
        .eq("path", path)
        .maybeSingle();
      if (readError) throw translateDbError(readError);

      const { error } = await supabase
        .from("project_files")
        .upsert(
          { project_id: projectId, path, content, updated_at: new Date().toISOString() },
          { onConflict: "project_id,path" },
        );
      if (error) throw translateDbError(error);
      return { existed: existing !== null };
    },

    async remove(path) {
      const { data, error } = await supabase
        .from("project_files")
        .delete()
        .eq("project_id", projectId)
        .eq("path", path)
        .select("id");
      if (error) throw translateDbError(error);
      return (data?.length ?? 0) > 0;
    },
  };
}
