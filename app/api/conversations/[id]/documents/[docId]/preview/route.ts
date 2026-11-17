import { getVerifiedUser } from "@/lib/db/auth";
import { getConversationDocument } from "@/lib/db/conversations";
import { loadImageBytes } from "@/lib/db/images";
import { base64Of, imageInfo } from "@/lib/documents/image";
import { deckSpecSchema, documentSpecSchema, imageIdsIn } from "@/lib/documents/spec";
import { withApi } from "@/lib/security/api";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";

// The stored outline of a document, for the in-chat preview. Ownership comes from RLS. The outline
// is re-validated on the way out, and pictures come back as data URLs of PNG or JPEG bytes that
// were checked when they were uploaded and are checked again here.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await context.params;
  return withApi("agent.document.preview", async () => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.documentDownloadUser, key: user.id }]);
    const document = await getConversationDocument(id, docId);
    if (document.kind === "pptx") {
      const deck = deckSpecSchema.parse(document.spec);
      const ids = imageIdsIn(deck);
      const images = new Map<string, string>();
      if (ids.length > 0) {
        const loaded = await loadImageBytes(id, ids).catch(() => new Map<string, Uint8Array>());
        for (const [imageId, bytes] of loaded) {
          const info = imageInfo(bytes);
          if (info) images.set(imageId, `data:${info.mime};base64,${base64Of(bytes)}`);
        }
      }
      return Response.json({
        kind: "pptx",
        title: document.title,
        deck,
        images: Object.fromEntries(images),
      });
    }
    return Response.json({
      kind: document.kind,
      title: document.title,
      document: documentSpecSchema.parse(document.spec),
    });
  })(request);
}
