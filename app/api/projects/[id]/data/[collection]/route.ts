import { getVerifiedUser } from "@/lib/db/auth";
import {
  checkCollection,
  createRecord,
  listRecords,
  MAX_RECORD_BYTES,
  recordBodySchema,
} from "@/lib/db/project-data";
import { getProject } from "@/lib/db/projects";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";

// The built-in data store behind a project's generated app. Owner only: the project is looked up
// with the caller's own session first (someone else's project is a 404), and every statement runs
// under row level security. Called by the workspace page on behalf of the preview frame, never
// directly by generated code.

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; collection: string }> },
) {
  const { id, collection } = await context.params;
  return withApi("projects.data.list", async () => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.projectDataUser, key: user.id }]);
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    const records = await listRecords(id, checkCollection(collection), supabase);
    return Response.json({ records });
  })(request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; collection: string }> },
) {
  const { id, collection } = await context.params;
  return withApi("projects.data.create", async () => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.projectDataUser, key: user.id }]);
    const body = await readJson(request, recordBodySchema, MAX_RECORD_BYTES + 1024);
    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);
    const record = await createRecord(id, checkCollection(collection), body, supabase);
    return Response.json({ record }, { status: 201 });
  })(request);
}
