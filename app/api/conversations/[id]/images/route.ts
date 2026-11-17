import { getVerifiedUser } from "@/lib/db/auth";
import { insertConversationImage } from "@/lib/db/images";
import { base64Of, imageInfo, MAX_IMAGE_BYTES } from "@/lib/documents/image";
import { withApi } from "@/lib/security/api";
import { AppError } from "@/lib/security/errors";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";
import { readBytes } from "@/lib/security/request";

// Attaches one picture to a conversation. The body is the raw file; the name comes in the query.
// What counts is what the bytes are (a real PNG or JPEG within the size and dimension limits),
// never the declared content type or the extension. Ownership comes from RLS on the insert.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withApi("agent.image", async (req) => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.imageUploadUser, key: user.id }]);
    const bytes = await readBytes(req, MAX_IMAGE_BYTES);
    const info = imageInfo(bytes);
    if (!info) {
      throw new AppError(
        400,
        "invalid_image",
        "Use a PNG or JPEG picture up to 2 MB and 8000 pixels on its longest side.",
      );
    }
    const raw = new URL(req.url).searchParams.get("name") ?? "picture";
    const name =
      Array.from(raw)
        .filter((ch) => ch.charCodeAt(0) > 31 && !'"<>\\/'.includes(ch))
        .join("")
        .trim()
        .slice(0, 80) || "picture";
    const image = await insertConversationImage(id, {
      name,
      mime: info.mime,
      width: info.width,
      height: info.height,
      data: base64Of(bytes),
    });
    return Response.json({ image }, { status: 201 });
  })(request);
}
