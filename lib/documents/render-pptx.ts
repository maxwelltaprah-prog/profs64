import "server-only";

import PptxGenJS from "pptxgenjs";

import { base64Of, imageInfo } from "./image";
import { type DeckSpec, type Visual } from "./spec";

// A restrained 16:9 deck: white slides, near-black text, one accent rule, generous margins. Visuals
// (charts, stat cards, process flows, timelines) are native PowerPoint objects drawn from the
// slide's data. Pictures are only the ones the person uploaded: PNG or JPEG bytes that were checked
// on upload and are checked again here, passed in by the caller, never fetched.
const INK = "1C1C1E";
const MUTED = "6B6B72";
const ACCENT = "0F766E";
const FONT = "Calibri";
const LINE = "D9D9DE";
const SURFACE = "F6F6F7";
const SERIES = [ACCENT, "64748B", "B45309", "1D4ED8"];

// A picture the caller has already loaded, by id.
export type DeckImages = ReadonlyMap<string, Uint8Array>;

type Page = ReturnType<PptxGenJS["addSlide"]>;
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawVisual(page: Page, visual: Visual, box: Box, images: DeckImages) {
  const { x, y, w, h } = box;
  if (visual.type === "chart") {
    const labels = visual.categories;
    const data = visual.series.map((series) => ({
      name: series.name,
      labels,
      // A series shorter than the categories is padded so the chart stays aligned.
      values: labels.map((_, index) => series.values.at(index) ?? 0),
    }));
    const kind = visual.kind;
    const circular = visual.kind === "pie" || visual.kind === "doughnut";
    page.addChart(kind, data, {
      x,
      y,
      w,
      h,
      chartColors: circular
        ? labels.map((_, i) => SERIES[i % SERIES.length] ?? ACCENT)
        : SERIES.slice(0, data.length),
      showLegend: circular || data.length > 1,
      legendPos: "b",
      legendFontFace: FONT,
      legendFontSize: 12,
      legendColor: MUTED,
      showTitle: Boolean(visual.title),
      ...(visual.title
        ? { title: visual.title, titleFontFace: FONT, titleFontSize: 14, titleColor: INK }
        : {}),
      catAxisLabelFontFace: FONT,
      catAxisLabelFontSize: 12,
      catAxisLabelColor: MUTED,
      valAxisLabelFontFace: FONT,
      valAxisLabelFontSize: 12,
      valAxisLabelColor: MUTED,
      valGridLine: { color: LINE, size: 0.5 },
      catGridLine: { style: "none" },
      showValue: circular || (data.length === 1 && labels.length <= 8),
      dataLabelFontFace: FONT,
      dataLabelFontSize: 12,
      dataLabelColor: circular ? "FFFFFF" : INK,
      ...(visual.kind === "bar" ? { barGapWidthPct: 60 } : {}),
      ...(visual.kind === "line" ? { lineSize: 3, lineDataSymbolSize: 8 } : {}),
    });
    return;
  }

  if (visual.type === "stats") {
    const count = visual.items.length;
    const gap = 0.3;
    const width = (w - gap * (count - 1)) / count;
    const height = Math.min(h, 2.4);
    const top = y + (h - height) / 2;
    visual.items.forEach((item, index) => {
      const left = x + index * (width + gap);
      page.addShape("roundRect", {
        x: left,
        y: top,
        w: width,
        h: height,
        rectRadius: 0.08,
        fill: { color: SURFACE },
        line: { color: LINE, width: 0.75 },
      });
      page.addText(item.value, {
        x: left + 0.2,
        y: top + 0.25,
        w: width - 0.4,
        h: 1.0,
        fontFace: FONT,
        fontSize: 36,
        bold: true,
        color: ACCENT,
        valign: "middle",
        fit: "shrink",
      });
      page.addText(item.label, {
        x: left + 0.2,
        y: top + 1.25,
        w: width - 0.4,
        h: height - 1.45,
        fontFace: FONT,
        fontSize: 14,
        color: MUTED,
        valign: "top",
      });
    });
    return;
  }

  if (visual.type === "process") {
    const count = visual.steps.length;
    const gap = 0.45;
    const width = (w - gap * (count - 1)) / count;
    const height = Math.min(h, 2.8);
    const top = y + (h - height) / 2;
    visual.steps.forEach((step, index) => {
      const left = x + index * (width + gap);
      page.addShape("roundRect", {
        x: left,
        y: top,
        w: width,
        h: height,
        rectRadius: 0.08,
        fill: { color: "FFFFFF" },
        line: { color: LINE, width: 1 },
      });
      page.addShape("ellipse", {
        x: left + 0.2,
        y: top + 0.2,
        w: 0.42,
        h: 0.42,
        fill: { color: ACCENT },
        line: { color: ACCENT },
      });
      page.addText(String(index + 1), {
        x: left + 0.2,
        y: top + 0.2,
        w: 0.42,
        h: 0.42,
        fontFace: FONT,
        fontSize: 14,
        bold: true,
        color: "FFFFFF",
        align: "center",
        valign: "middle",
      });
      page.addText(step.title, {
        x: left + 0.2,
        y: top + 0.75,
        w: width - 0.4,
        h: 0.6,
        fontFace: FONT,
        fontSize: 16,
        bold: true,
        color: INK,
        valign: "top",
        fit: "shrink",
      });
      if (step.text) {
        page.addText(step.text, {
          x: left + 0.2,
          y: top + 1.35,
          w: width - 0.4,
          h: height - 1.5,
          fontFace: FONT,
          fontSize: 12,
          color: MUTED,
          valign: "top",
          fit: "shrink",
        });
      }
      if (index < count - 1) {
        page.addShape("rightArrow", {
          x: left + width + 0.08,
          y: top + height / 2 - 0.14,
          w: gap - 0.16,
          h: 0.28,
          fill: { color: MUTED },
          line: { color: MUTED },
        });
      }
    });
    return;
  }

  if (visual.type === "timeline") {
    const count = visual.events.length;
    const width = w / count;
    const lineY = y + h * 0.36;
    page.addShape("line", { x, y: lineY, w, h: 0, line: { color: LINE, width: 2 } });
    visual.events.forEach((event, index) => {
      const left = x + index * width;
      page.addText(event.label, {
        x: left,
        y: lineY - 0.7,
        w: width - 0.1,
        h: 0.45,
        fontFace: FONT,
        fontSize: 13,
        bold: true,
        color: ACCENT,
        valign: "bottom",
        fit: "shrink",
      });
      page.addShape("ellipse", {
        x: left + 0.02,
        y: lineY - 0.11,
        w: 0.22,
        h: 0.22,
        fill: { color: ACCENT },
        line: { color: "FFFFFF", width: 2 },
      });
      page.addText(event.title, {
        x: left,
        y: lineY + 0.25,
        w: width - 0.2,
        h: 0.6,
        fontFace: FONT,
        fontSize: 15,
        bold: true,
        color: INK,
        valign: "top",
        fit: "shrink",
      });
      if (event.text) {
        page.addText(event.text, {
          x: left,
          y: lineY + 0.85,
          w: width - 0.2,
          h: Math.max(0.6, h - (lineY - y) - 1.0),
          fontFace: FONT,
          fontSize: 12,
          color: MUTED,
          valign: "top",
          fit: "shrink",
        });
      }
    });
    return;
  }

  // A picture the person uploaded. Re-checked here; one that is missing or not a real PNG or JPEG
  // is left out rather than failing the whole deck.
  const bytes = images.get(visual.imageId);
  const info = bytes ? imageInfo(bytes) : null;
  if (!bytes || !info) return;
  const captionHeight = visual.caption ? 0.4 : 0;
  const maxW = w;
  const maxH = h - captionHeight;
  const scale = Math.min(maxW / info.width, maxH / info.height);
  const width = info.width * scale;
  const height = info.height * scale;
  const left = x + (maxW - width) / 2;
  page.addImage({
    data: `${info.mime};base64,${base64Of(bytes)}`,
    x: left,
    y,
    w: width,
    h: height,
    altText: visual.caption ?? "Picture",
  });
  if (visual.caption) {
    page.addText(visual.caption, {
      x,
      y: y + height + 0.05,
      w,
      h: captionHeight,
      fontFace: FONT,
      fontSize: 12,
      italic: true,
      color: MUTED,
      align: "center",
      valign: "top",
    });
  }
}

export async function renderPptx(
  spec: DeckSpec,
  images: DeckImages = new Map(),
): Promise<Uint8Array> {
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
    // Charts and pictures sit beside the bullets; the wide visuals (stat cards, process flow,
    // timeline) take a band below them.
    const visual = slide.visual;
    const side = visual?.type === "chart" || visual?.type === "image";
    const hasBullets = Boolean(slide.bullets && slide.bullets.length > 0);
    const textWidth = visual && side && hasBullets ? 5.2 : 11.7;
    let top = 1.7;
    if (slide.bullets && slide.bullets.length > 0) {
      const limit = visual && !side ? 1.7 : 4.6;
      const height = Math.min(limit, (visual && !side ? 0.42 : 0.55) * slide.bullets.length + 0.3);
      page.addText(
        slide.bullets.map((bullet) => ({
          text: bullet,
          options: { bullet: { indent: 18 }, paraSpaceAfter: visual && !side ? 4 : 8 },
        })),
        {
          x: 0.8,
          y: top,
          w: textWidth,
          h: height,
          fontFace: FONT,
          fontSize: visual && !side ? 16 : textWidth < 11 ? 18 : 20,
          color: INK,
          valign: "top",
        },
      );
      top += height + 0.2;
    }
    if (slide.body) {
      page.addText(slide.body, {
        x: 0.8,
        y: Math.min(top, visual && !side ? 3.4 : 6.0),
        w: textWidth,
        h: visual && !side ? 0.6 : 1.0,
        fontFace: FONT,
        fontSize: 16,
        color: MUTED,
        valign: "top",
      });
      if (visual && !side) top = Math.max(top, 3.4) + 0.7;
    }
    if (visual) {
      const box: Box = side
        ? hasBullets
          ? { x: 6.4, y: 1.7, w: 6.1, h: 4.9 }
          : { x: 0.8, y: 1.7, w: 11.7, h: 4.9 }
        : {
            x: 0.8,
            y: Math.max(Math.min(top, 3.5), 1.7),
            w: 11.7,
            h: 6.6 - Math.max(Math.min(top, 3.5), 1.7),
          };
      drawVisual(page, visual, box, images);
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
