import "server-only";

import PptxGenJS from "pptxgenjs";

import { type DeckSpec } from "./spec";

// A restrained 16:9 deck: white slides, near-black text, one accent rule, generous margins. Text
// only: no images are ever passed in, so pptxgenjs's image parsing is never used.
const INK = "1C1C1E";
const MUTED = "6B6B72";
const ACCENT = "0F766E";
const FONT = "Calibri";

export async function renderPptx(spec: DeckSpec): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = spec.title;
  pptx.author = "Buildr";

  const cover = pptx.addSlide();
  cover.background = { color: "FFFFFF" };
  cover.addShape("rect", {
    x: 0.8,
    y: 3.05,
    w: 0.9,
    h: 0.08,
    fill: { color: ACCENT },
    line: { color: ACCENT },
  });
  cover.addText(spec.title, {
    x: 0.8,
    y: 1.6,
    w: 11.7,
    h: 1.4,
    fontFace: FONT,
    fontSize: 40,
    bold: true,
    color: INK,
    valign: "bottom",
  });
  if (spec.subtitle) {
    cover.addText(spec.subtitle, {
      x: 0.8,
      y: 3.35,
      w: 11.7,
      h: 1.0,
      fontFace: FONT,
      fontSize: 20,
      color: MUTED,
      valign: "top",
    });
  }

  spec.slides.forEach((slide, index) => {
    const page = pptx.addSlide();
    page.background = { color: "FFFFFF" };
    page.addShape("rect", {
      x: 0.8,
      y: 1.35,
      w: 0.6,
      h: 0.06,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });
    page.addText(slide.title, {
      x: 0.8,
      y: 0.45,
      w: 11.7,
      h: 0.85,
      fontFace: FONT,
      fontSize: 30,
      bold: true,
      color: INK,
      valign: "bottom",
    });
    let top = 1.7;
    if (slide.bullets && slide.bullets.length > 0) {
      const height = Math.min(4.6, 0.55 * slide.bullets.length + 0.3);
      page.addText(
        slide.bullets.map((bullet) => ({
          text: bullet,
          options: { bullet: { indent: 18 }, paraSpaceAfter: 8 },
        })),
        {
          x: 0.8,
          y: top,
          w: 11.7,
          h: height,
          fontFace: FONT,
          fontSize: 20,
          color: INK,
          valign: "top",
        },
      );
      top += height + 0.2;
    }
    if (slide.body) {
      page.addText(slide.body, {
        x: 0.8,
        y: Math.min(top, 6.0),
        w: 11.7,
        h: 1.0,
        fontFace: FONT,
        fontSize: 16,
        color: MUTED,
        valign: "top",
      });
    }
    page.addText(`${index + 2}`, {
      x: 12.1,
      y: 6.9,
      w: 0.6,
      h: 0.35,
      fontFace: FONT,
      fontSize: 11,
      color: MUTED,
      align: "right",
    });
    if (slide.notes) page.addNotes(slide.notes);
  });

  const output = await pptx.write({ outputType: "uint8array" });
  return output as Uint8Array;
}
