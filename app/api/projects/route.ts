import { auditBestEffort } from "@/lib/db/audit";
import { getVerifiedUser } from "@/lib/db/auth";
import { createProject, listProjects } from "@/lib/db/projects";
import { withApi } from "@/lib/security/api";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";
import { createProjectSchema, PROJECT_BODY_LIMIT_BYTES } from "@/lib/security/schemas";

export const GET = withApi("projects.list", async () => {
  await getVerifiedUser();
  return Response.json({ projects: await listProjects() });
});

export const POST = withApi("projects.create", async (request, { requestId }) => {
  const user = await getVerifiedUser();
  await enforceLimits([{ config: LIMITS.projectCreateUser, key: user.id }]);

  const body = await readJson(request, createProjectSchema, PROJECT_BODY_LIMIT_BYTES);
  const project = await createProject(user.id, body.name);
  await auditBestEffort({
    userId: user.id,
    event: "project_created",
    requestId,
    metadata: { projectId: project.id },
  });
  return Response.json({ project }, { status: 201 });
});
