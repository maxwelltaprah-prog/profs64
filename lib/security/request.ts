import { type ZodType } from "zod";

import { badRequest, payloadTooLarge, unsupportedMediaType, validationFailed } from "./errors";

// Reads the body as a stream and stops at maxBytes, because Content-Length can be absent
// or false. Never buffers more than maxBytes + one chunk.
async function readCapped(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw payloadTooLarge();
  if (request.body === null) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let received = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw payloadTooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof TypeError) throw badRequest();
    throw error;
  }
  return text;
}

export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes: number,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw unsupportedMediaType();

  const raw = await readCapped(request, maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest();
  }

  const result = schema.safeParse(parsed);
  if (!result.success) throw validationFailed();
  return result.data;
}
