import { getVerifiedUser } from "@/lib/db/auth";
import { getProject, listProjectFiles } from "@/lib/db/projects";
import { withApi } from "@/lib/security/api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("projects.files", async () => {
    await getVerifiedUser();
    await getProject(id);
    return Response.json({ files: await listProjectFiles(id) });
  })(request);
}
