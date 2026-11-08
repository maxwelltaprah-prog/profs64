import { getVerifiedUser } from "@/lib/db/auth";
import { createDbFileStore } from "@/lib/db/files";
import { getProject, listProjectFiles } from "@/lib/db/projects";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { withApi } from "@/lib/security/api";
import { badRequest } from "@/lib/security/errors";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { ATTACHMENT_BODY_LIMIT_BYTES, attachmentsBodySchema } from "@/lib/security/schemas";
import { checkAttachment } from "@/lib/workspace/attachments";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("projects.files", async () => {
    await getVerifiedUser();
    await getProject(id);
    return Response.json({ files: await listProjectFiles(id) });
  })(request);
}

// Adds text files the person attached to a message, as project files under attachments/. The
// name and contents are validated here whatever the browser already checked, and the write goes
// through the same store the assistant's tools use, so path, size and file-count rules and row
// level security all apply.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("projects.attach", async () => {
    const user = await getVerifiedUser();
    const body = await readJson(request, attachmentsBodySchema, ATTACHMENT_BODY_LIMIT_BYTES);
    await enforceLimits([{ config: LIMITS.attachUser, key: user.id }]);

    const supabase = await createSupabaseServerClient();
    await getProject(id, supabase);

    const checked = body.files.map((file) => ({
      content: file.content,
      result: checkAttachment(file.name, file.content),
    }));
    if (checked.some(({ result }) => !result.ok)) {
      throw badRequest("One of the files cannot be used.");
    }

    const store = createDbFileStore(supabase, id);
    const paths: string[] = [];
    for (const { content, result } of checked) {
      if (!result.ok) continue;
      await store.write(result.path, content);
      paths.push(result.path);
    }
    return Response.json({ paths }, { status: 201 });
  })(request);
}
