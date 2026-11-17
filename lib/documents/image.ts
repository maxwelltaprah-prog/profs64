// What the deck renderer and the upload route need to know about a picture without decoding it:
// whether it really is a PNG or JPEG (by its first bytes, not its name or declared type) and how
// big it is, read from the header. Anything else is refused, which also keeps SVG (scriptable) and
// formats with odd parsers out of the pipeline.
export interface ImageInfo {
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 8000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 24 || bytes.length > MAX_IMAGE_BYTES) return null;
  let found: ImageInfo | null = null;
  if (PNG_SIGNATURE.every((byte, index) => bytes.at(index) === byte)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // The first chunk of a PNG must be IHDR, which holds width and height.
    if (String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
    found = { mime: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    found = jpegInfo(bytes);
  }
  if (!found) return null;
  const { width, height } = found;
  if (width < 1 || height < 1 || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) return null;
  return found;
}

function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes.at(offset) !== 0xff) return null;
    let marker = bytes[offset + 1] ?? 0;
    // Fill bytes before a marker.
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1;
      marker = bytes[offset + 1] ?? 0;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    // Start-of-frame markers carry the size (not DHT 0xc4, JPG 0xc8 or DAC 0xcc).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 9 > bytes.length) return null;
      return {
        mime: "image/jpeg",
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

export function base64Of(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function bytesOfBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}
