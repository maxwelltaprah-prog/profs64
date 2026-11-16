import { auditBestEffort } from "@/lib/db/audit";
import { getVerifiedUser } from "@/lib/db/auth";
import { getProject, listProjectFiles } from "@/lib/db/projects";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { parseRepoInput, pushToGitHub } from "@/lib/github/push";
import { withApi } from "@/lib/security/api";
import { badRequest } from "@/lib/security/errors";
import { GITHUB_PUSH_BODY_LIMIT_BYTES } from "@/lib/security/limits";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { githubPushSchema } from "@/lib/security/schemas";

type Context = { params: Promise<{ id: string }> };

// Pushes the project's files to a GitHub repository. The person's token arrives in the body, is
// used for this request only and is never stored or logged. Ownership comes from RLS.
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("projects.github.push", async (_request, { requestId }) => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.githubPushUser, key: user.id }]);
    const body = await readJson(request, githubPushSchema, GITHUB_PUSH_BODY_LIMIT_BYTES);
    const target = parseRepoInput(body.repo);
    if (!target) throw badRequest("Use the form owner/repository.");

    const supabase = await createSupabaseServerClient();
    const project = await getProject(id, supabase);
    const files = await listProjectFiles(id, supabase);
    if (files.length === 0) throw badRequest("This project has no files to push yet.");

    const result = await pushToGitHub({
      token: body.token,
      owner: target.owner,
      repo: target.repo,
      branch: body.branch,
      message: body.message || `Update ${project.name} from Buildr`.slice(0, 200),
      files: files.map((file) => ({ path: file.path, content: file.content })),
      create: body.create,
    });

    await auditBestEffort({
      userId: user.id,
      event: "github_push",
      metadata: {
        files: result.fileCount,
        created: result.createdRepo,
        unchanged: result.unchanged,
      },
      requestId,
    });
    return Response.json(result);
  })(request);
}
