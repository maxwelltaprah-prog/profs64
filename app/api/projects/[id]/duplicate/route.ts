import { auditBestEffort } from "@/lib/db/audit";
import { getVerifiedUser } from "@/lib/db/auth";
import { duplicateProject } from "@/lib/db/projects";
import { withApi } from "@/lib/security/api";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";

type Context = { params: Promise<{ id: string }> };

// Copies a project's files into a new project. Ownership of the source comes from RLS, so
// someone else's project is a 404. Shares the project-creation limit.
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return withApi("projects.duplicate", async (_request, { requestId }) => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.projectCreateUser, key: user.id }]);
    const project = await duplicateProject(user.id, id);
    await auditBestEffort({
      userId: user.id,
      event: "project_created",
      requestId,
      metadata: { projectId: project.id, copiedFrom: id },
    });
    return Response.json({ project }, { status: 201 });
  })(request);
}
