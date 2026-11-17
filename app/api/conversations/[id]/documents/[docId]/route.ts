import { getVerifiedUser } from "@/lib/db/auth";
import { getConversationDocument } from "@/lib/db/conversations";
import { loadImageBytes } from "@/lib/db/images";
import { renderDocument } from "@/lib/documents/render";
import { fileNameFor, imageIdsIn, MIME, deckSpecSchema } from "@/lib/documents/spec";
import { withApi } from "@/lib/security/api";
import { logger } from "@/lib/security/logger";
import { enforceLimits, LIMITS } from "@/lib/security/rate-limit";

// Renders a document the assistant created, from its stored outline, as a download. Ownership
// comes from RLS: someone else's document is a 404.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await context.params;
  return withApi("agent.document", async (_request, { requestId }) => {
    const user = await getVerifiedUser();
    await enforceLimits([{ config: LIMITS.documentDownloadUser, key: user.id }]);
    const document = await getConversationDocument(id, docId);
    let bytes: Uint8Array;
    try {
      // A deck may use pictures the person attached. If they cannot be loaded the deck is still
      // made, without them, rather than failing the download.
      let images: Map<string, Uint8Array> | undefined;
      if (document.kind === "pptx") {
        const deck = deckSpecSchema.safeParse(document.spec);
        const ids = deck.success ? imageIdsIn(deck.data) : [];
        if (ids.length > 0) images = await loadImageBytes(id, ids).catch(() => undefined);
      }
      bytes = await renderDocument(document.kind, document.spec, images);
    } catch (error) {
      logger.error("document_render_failed", {
        requestId,
        kind: document.kind,
        errorName: error instanceof Error ? error.name : "unknown",
      });
      return Response.json(
        {
          error: {
            code: "render_failed",
            message: "This document could not be created. Ask the assistant to make it again.",
          },
        },
        { status: 500 },
      );
    }
    const name = fileNameFor(document.title, document.kind);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": MIME[document.kind],
        "content-disposition": `attachment; filename="${name}"`,
        "content-length": String(bytes.byteLength),
        "x-content-type-options": "nosniff",
      },
    });
  })(request);
}
