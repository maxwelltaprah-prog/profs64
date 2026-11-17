import { getVerifiedUser } from "@/lib/db/auth";
import {
  checkCollection,
  checkRecordId,
  deleteRecord,
  MAX_RECORD_BYTES,
  recordBodySchema,
  updateRecord,
} from "@/lib/db/project-data";
import { getProject } from "@/lib/db/projects";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";

type Context = { params: Promise<{ id: string; collection: string; recordId: string }> };

export async function PUT(request: Request, context: Context) {
  const { id, collection, recordId } = await context.params;
  return withApi("projects.data.update", async () => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.projectDataUser, key: user.id }]);
    const body = await readJson(request, recordBodySchema, MAX_RECORD_BYTES + 1024);
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    const record = await updateRecord(
      id,
      checkCollection(collection),
      checkRecordId(recordId),
      body,
      supabase,
    );
    return Response.json({ record });
  })(request);
}

export async function DELETE(request: Request, context: Context) {
  const { id, collection, recordId } = await context.params;
  return withApi("projects.data.delete", async () => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.projectDataUser, key: user.id }]);
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    await deleteRecord(id, checkCollection(collection), checkRecordId(recordId), supabase);
    return new Response(null, { status: 204 });
  })(request);
}
