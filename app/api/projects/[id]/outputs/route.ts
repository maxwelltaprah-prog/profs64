import { getVerifiedUser } from "@/lib/db/auth";
import { listRatings, outputsFor } from "@/lib/db/outputs";
import { getProject, listMessages } from "@/lib/db/projects";
import { withApi } from "@/lib/security/api";

// Credits used and the person's own rating for each reply in a project.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("projects.outputs", async () => {
    await getVerifiedUser();
    await getProject(id);
    const [messages, ratings] = await Promise.all([listMessages(id), listRatings(id)]);
    return Response.json({ outputs: outputsFor(messages, ratings) });
  })(request);
}
