// Pictures a person attaches in the assistant chat so a deck can use them. Zod-free: the browser
// imports this too. The server re-checks every byte; these checks only give quick feedback.

export const MAX_IMAGES_PER_MESSAGE = 5;
export const MAX_CHAT_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/png,image/jpeg";

export interface ChatImage {
  id: string;
  name: string;
  width: number;
  height: number;
}

// Appended to the message text, so the person and the assistant both see which pictures went with
// it and the assistant has the ids it needs for an image slide.
export function imageMarkerLine(images: readonly ChatImage[]): string {
  if (images.length === 0) return "";
  return `[Images attached: ${images
    .map((image) => `id=${image.id} name="${image.name}" ${image.width}x${image.height}`)
    .join("; ")}]`;
}

export function withImageMarker(text: string, images: readonly ChatImage[]): string {
  const line = imageMarkerLine(images);
  return line ? `${text}\n\n${line}` : text;
}

export function quickImageCheck(file: File): string | null {
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    return `${file.name} is not a PNG or JPEG picture.`;
  }
  if (file.size > MAX_CHAT_IMAGE_BYTES) return `${file.name} is larger than 2 MB.`;
  return null;
}

export async function uploadChatImage(conversationId: string, file: File): Promise<ChatImage> {
  const response = await fetch(
    `/api/conversations/${conversationId}/images?name=${encodeURIComponent(file.name)}`,
    { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file },
  );
  const body = (await response.json().catch(() => null)) as {
    image?: ChatImage;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.image) {
    throw new Error(body?.error?.message ?? `${file.name} could not be attached. Try again.`);
  }
  return body.image;
}

const MARKER_LINE = /\n*\[Images attached: ([^\]]*)\]\s*$/;

// Splits the marker off a stored message so the bubble can show names, not ids.
export function splitImageMarker(text: string): { text: string; names: string[] } {
  const match = MARKER_LINE.exec(text);
  if (!match) return { text, names: [] };
  const names = Array.from((match[1] ?? "").matchAll(/name="([^"]*)"/g)).map((m) => m[1] ?? "");
  return { text: text.slice(0, match.index), names };
}
