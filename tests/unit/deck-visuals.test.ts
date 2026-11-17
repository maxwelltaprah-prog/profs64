import { deflateSync } from "node:zlib";

import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import { createAgentTools } from "@/lib/agent/tools";
import { base64Of, imageInfo, MAX_IMAGE_BYTES } from "@/lib/documents/image";
import { renderPptx } from "@/lib/documents/render-pptx";
import { deckSpecSchema, imageIdsIn } from "@/lib/documents/spec";

vi.mock("server-only", () => ({}));

function crc(bytes: Uint8Array): number {
  let r = 0xffffffff;
  for (const b of bytes) {
    r ^= b;
    for (let k = 0; k < 8; k++) r = r & 1 ? 0xedb88320 ^ (r >>> 1) : r >>> 1;
  }
  return (r ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([length, body, sum]);
}
export function png(width: number, height: number): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(Math.min(width, 64) * 3)]);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(row)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
const jpeg = (width: number, height: number) => {
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0, 17, 8]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.alloc(8)]));
};

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("imageInfo", () => {
  it("reads real PNG and JPEG headers", () => {
    expect(imageInfo(png(400, 250))).toEqual({ mime: "image/png", width: 400, height: 250 });
    expect(imageInfo(jpeg(640, 480))).toEqual({ mime: "image/jpeg", width: 640, height: 480 });
  });
  it("rejects SVG, GIF, text, truncated, oversize and absurd dimensions", () => {
    const enc = (text: string) => new TextEncoder().encode(text.padEnd(64, " "));
    expect(imageInfo(enc('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(imageInfo(enc("GIF89a"))).toBeNull();
    expect(imageInfo(new Uint8Array(10))).toBeNull();
    expect(imageInfo(new Uint8Array(MAX_IMAGE_BYTES + 1))).toBeNull();
    expect(imageInfo(png(9000, 10))).toBeNull();
    expect(imageInfo(png(0, 10))).toBeNull();
    const spoofed = png(10, 10).slice();
    spoofed[1] = 0;
    expect(imageInfo(spoofed)).toBeNull();
  });
});

describe("deck visuals", () => {
  const base = { title: "T", slides: [{ title: "S" }] };
  it("accepts each visual and rejects malformed ones", () => {
    const good = [
      {
        type: "chart",
        kind: "bar",
        categories: ["a", "b"],
        series: [{ name: "x", values: [1, 2] }],
      },
      {
        type: "stats",
        items: [
          { value: "1", label: "a" },
          { value: "2", label: "b" },
        ],
      },
      { type: "process", steps: [{ title: "a" }, { title: "b" }] },
      {
        type: "timeline",
        events: [
          { label: "1", title: "a" },
          { label: "2", title: "b" },
        ],
      },
      { type: "image", imageId: ID },
    ];
    for (const visual of good) {
      expect(deckSpecSchema.safeParse({ ...base, slides: [{ title: "S", visual }] }).success).toBe(
        true,
      );
    }
    const bad = [
      { type: "chart", kind: "bar", categories: ["a"], series: [{ name: "x", values: [1] }] },
      {
        type: "chart",
        kind: "bar",
        categories: ["a", "b"],
        series: [{ name: "x", values: [1, Infinity] }],
      },
      {
        type: "chart",
        kind: "radar",
        categories: ["a", "b"],
        series: [{ name: "x", values: [1, 2] }],
      },
      { type: "image", imageId: "../../etc/passwd" },
      { type: "image", imageId: ID, url: "https://evil.example/x.png" },
      { type: "html", text: "<b>" },
      { type: "stats", items: [{ value: "1", label: "a" }] },
    ];
    for (const visual of bad) {
      expect(deckSpecSchema.safeParse({ ...base, slides: [{ title: "S", visual }] }).success).toBe(
        false,
      );
    }
  });
  it("lists the picture ids a deck uses, once each", () => {
    const deck = deckSpecSchema.parse({
      title: "T",
      slides: [
        { title: "a", visual: { type: "image", imageId: ID } },
        { title: "b", visual: { type: "image", imageId: ID } },
        { title: "c", visual: { type: "image", imageId: OTHER } },
      ],
    });
    expect(imageIdsIn(deck).sort()).toEqual([ID, OTHER].sort());
  });
});

describe("renderPptx with visuals", () => {
  const deck = deckSpecSchema.parse({
    title: "Visuals",
    slides: [
      {
        title: "Chart",
        bullets: ["a"],
        visual: {
          type: "chart",
          kind: "line",
          categories: ["a", "b"],
          series: [{ name: "x", values: [1, 2] }],
        },
      },
      { title: "Pic", visual: { type: "image", imageId: ID, caption: "Cap" } },
      { title: "Missing", visual: { type: "image", imageId: OTHER } },
    ],
  });
  it("writes native charts and the uploaded picture, and skips a missing picture", async () => {
    const bytes = await renderPptx(deck, new Map([[ID, png(400, 250)]]));
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.startsWith("ppt/charts/chart"))).toBe(true);
    expect(names.filter((n) => n.startsWith("ppt/media/") && !n.endsWith("/"))).toHaveLength(1);
  });
  it("ignores bytes that are not a real picture", async () => {
    const bytes = await renderPptx(
      deck,
      new Map([[ID, new TextEncoder().encode("<svg/>".padEnd(64))]]),
    );
    const zip = await JSZip.loadAsync(bytes);
    expect(
      Object.keys(zip.files).filter((n) => n.startsWith("ppt/media/") && !n.endsWith("/")),
    ).toHaveLength(0);
  });
  it("round-trips base64", () => {
    expect(base64Of(png(2, 2)).length).toBeGreaterThan(10);
  });
});

describe("create_document and pictures", () => {
  const deck = { title: "T", slides: [{ title: "S", visual: { type: "image", imageId: ID } }] };
  const run = async (known: string[]) => {
    const save = vi.fn(async () => ({ id: "d1" }));
    const tools = createAgentTools({ save, knownImages: async () => new Set(known) });
    const result = await tools.create_document.execute?.(
      { kind: "pptx", deck } as never,
      { toolCallId: "1", messages: [] } as never,
    );
    return { result, save };
  };
  it("saves when the picture belongs to the chat", async () => {
    const { result, save } = await run([ID]);
    expect(result).toMatchObject({ ok: true });
    expect(save).toHaveBeenCalled();
  });
  it("refuses a picture id that is not in this chat", async () => {
    const { result, save } = await run([]);
    expect(result).toMatchObject({ ok: false });
    expect(save).not.toHaveBeenCalled();
  });
});
