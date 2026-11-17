import "server-only";

import PptxGenJS from "pptxgenjs";

import { base64Of, imageInfo } from "./image";
import { type DeckSpec, type Visual } from "./spec";
import { themeFor, type Theme } from "./themes";

// 16:9 decks with a theme each. Visuals (charts, stat cards, process flows, timelines) are native
// PowerPoint objects drawn from the slide's data. Pictures are only the ones the person uploaded:
// PNG or JPEG bytes that were checked on upload and are checked again here, passed in by the
// caller, never fetched. The "academic" style follows the communication-first rules of the
// academic-pptx skill (github.com/Gabberflast/academic-pptx-skill, MIT): one sans-serif face,
// navy and blue, white content slides, no decoration under titles, 20 pt body, sources on slides.
// A picture the caller has already loaded, by id.
export type DeckImages = ReadonlyMap<string, Uint8Array>;

type Page = ReturnType<PptxGenJS["addSlide"]>;
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawVisual(page: Page, visual: Visual, box: Box, images: DeckImages, t: Theme) {
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
        ? labels.map((_, i) => t.series[i % t.series.length] ?? t.accent)
        : t.series.slice(0, data.length),
      showLegend: circular || data.length > 1,
      legendPos: "b",
      legendFontFace: t.font,
      legendFontSize: 12,
      legendColor: t.muted,
      showTitle: Boolean(visual.title),
      ...(visual.title
        ? { title: visual.title, titleFontFace: t.font, titleFontSize: 14, titleColor: t.ink }
        : {}),
      catAxisLabelFontFace: t.font,
      catAxisLabelFontSize: 12,
      catAxisLabelColor: t.muted,
      valAxisLabelFontFace: t.font,
      valAxisLabelFontSize: 12,
      valAxisLabelColor: t.muted,
      valGridLine: { color: t.line, size: 0.5 },
      catGridLine: { style: "none" },
      showValue: circular || (data.length === 1 && labels.length <= 8),
      dataLabelFontFace: t.font,
      dataLabelFontSize: 12,
      dataLabelColor: circular ? "FFFFFF" : t.ink,
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
        fill: { color: t.surface },
        line: { color: t.line, width: 0.75 },
      });
      page.addText(item.value, {
        x: left + 0.2,
        y: top + 0.25,
        w: width - 0.4,
        h: 1.0,
        fontFace: t.font,
        fontSize: 44,
        bold: true,
        color: t.accent,
        valign: "middle",
        fit: "shrink",
      });
      page.addText(item.label, {
        x: left + 0.2,
        y: top + 1.25,
        w: width - 0.4,
        h: height - 1.45,
        fontFace: t.font,
        fontSize: 16,
        color: t.muted,
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
        line: { color: t.line, width: 1 },
      });
      page.addShape("ellipse", {
        x: left + 0.2,
        y: top + 0.2,
        w: 0.42,
        h: 0.42,
        fill: { color: t.accent },
        line: { color: t.accent },
      });
      page.addText(String(index + 1), {
        x: left + 0.2,
        y: top + 0.2,
        w: 0.42,
        h: 0.42,
        fontFace: t.font,
        fontSize: 16,
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
        fontFace: t.font,
        fontSize: 18,
        bold: true,
        color: t.ink,
        valign: "top",
        fit: "shrink",
      });
      if (step.text) {
        page.addText(step.text, {
          x: left + 0.2,
          y: top + 1.35,
          w: width - 0.4,
          h: height - 1.5,
          fontFace: t.font,
          fontSize: 14,
          color: t.muted,
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
          fill: { color: t.muted },
          line: { color: t.muted },
        });
      }
    });
    return;
  }

  if (visual.type === "timeline") {
    const count = visual.events.length;
    const width = w / count;
    const lineY = y + h * 0.36;
    page.addShape("line", { x, y: lineY, w, h: 0, line: { color: t.line, width: 2 } });
    visual.events.forEach((event, index) => {
      const left = x + index * width;
      page.addText(event.label, {
        x: left,
        y: lineY - 0.7,
        w: width - 0.1,
        h: 0.45,
        fontFace: t.font,
        fontSize: 15,
        bold: true,
        color: t.accent,
        valign: "bottom",
        fit: "shrink",
      });
      page.addShape("ellipse", {
        x: left + 0.02,
        y: lineY - 0.11,
        w: 0.22,
        h: 0.22,
        fill: { color: t.accent },
        line: { color: "FFFFFF", width: 2 },
      });
      page.addText(event.title, {
        x: left,
        y: lineY + 0.25,
        w: width - 0.2,
        h: 0.6,
        fontFace: t.font,
        fontSize: 18,
        bold: true,
        color: t.ink,
        valign: "top",
        fit: "shrink",
      });
      if (event.text) {
        page.addText(event.text, {
          x: left,
          y: lineY + 0.85,
          w: width - 0.2,
          h: Math.max(0.6, h - (lineY - y) - 1.0),
          fontFace: t.font,
          fontSize: 14,
          color: t.muted,
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
      fontFace: t.font,
      fontSize: 12,
      italic: true,
      color: t.muted,
      align: "center",
      valign: "top",
    });
  }
}

export async function renderPptx(
  spec: DeckSpec,
  images: DeckImages = new Map(),
): Promise<Uint8Array> {
  const t = themeFor(spec);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = spec.title;
  pptx.author = "Buildr";

  // Cover: dark, with the title large and left-aligned.
  const cover = pptx.addSlide();
  cover.background = { color: t.primary };
  cover.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.35,
    h: 7.5,
    fill: { color: t.accent },
    line: { color: t.accent },
  });
  cover.addText(spec.title, {
    x: 1.0,
    y: 1.7,
    w: 11.3,
    h: 2.2,
    fontFace: t.font,
    fontSize: 44,
    bold: true,
    color: "FFFFFF",
    valign: "bottom",
    fit: "shrink",
  });
  if (!t.academic) {
    cover.addShape("rect", {
      x: 1.0,
      y: 4.1,
      w: 1.2,
      h: 0.07,
      fill: { color: t.accent },
      line: { color: t.accent },
    });
  }
  if (spec.subtitle) {
    cover.addText(spec.subtitle, {
      x: 1.0,
      y: 4.35,
      w: 11.3,
      h: 1.2,
      fontFace: t.font,
      fontSize: 22,
      color: "D6E2F0",
      valign: "top",
      fit: "shrink",
    });
  }

  spec.slides.forEach((slide, index) => {
    const page = pptx.addSlide();
    page.background = { color: "FFFFFF" };
    const visual = slide.visual;
    const side = visual?.type === "chart" || visual?.type === "image";
    const bullets = slide.bullets ?? [];
    const hasBullets = bullets.length > 0;

    // Title: action titles read as sentences, so they get two lines of room.
    if (!t.academic) {
      page.addShape("rect", {
        x: 0.55,
        y: 0.5,
        w: 0.09,
        h: 0.95,
        fill: { color: t.accent },
        line: { color: t.accent },
      });
    }
    page.addText(slide.title, {
      x: t.academic ? 0.6 : 0.85,
      y: 0.4,
      w: 11.9,
      h: 1.15,
      fontFace: t.font,
      fontSize: slide.title.length > 70 ? 26 : 30,
      bold: true,
      color: t.primary,
      valign: "middle",
      fit: "shrink",
    });
    if (t.academic) {
      page.addShape("rect", {
        x: 0.6,
        y: 1.6,
        w: 12.1,
        h: 0.02,
        fill: { color: t.line },
        line: { color: t.line },
      });
    }

    // Content area: y 1.85 to 6.5. Charts and pictures sit in a card beside the bullets (figure
    // left in the academic style, as the skill asks); wide visuals take a band below the text.
    const bodySize = t.academic ? 20 : 22;
    const figureFirst = t.academic;
    const figX = figureFirst ? 0.6 : 6.9;
    const textX = figureFirst && visual && side && hasBullets ? 7.2 : 0.85;
    const textW =
      visual && side && hasBullets ? 5.5 : !visual && slide.body && hasBullets ? 7.4 : 11.9;

    if (hasBullets) {
      const compact = Boolean(visual) && !side;
      const rows = compact ? Math.min(bullets.length, 4) : bullets.length;
      const height = compact ? Math.min(1.9, 0.45 * rows + 0.2) : Math.min(4.5, 0.75 * rows + 0.3);
      page.addText(
        bullets.map((bullet) => ({
          text: bullet,
          options: { bullet: { indent: 20 }, paraSpaceAfter: compact ? 4 : 12 },
        })),
        {
          x: textX,
          y: 1.9,
          w: textW,
          h: height,
          fontFace: t.font,
          fontSize: compact ? 18 : visual && side ? 20 : bodySize,
          color: t.ink,
          valign: "top",
          fit: "shrink",
        },
      );
    }

    // The supporting sentence becomes the callout: the one thing to remember from the slide.
    let bandTop = hasBullets
      ? visual && !side
        ? 1.9 + Math.min(1.9, 0.45 * Math.min(bullets.length, 4) + 0.2) + 0.1
        : 6.0
      : 1.9;
    if (slide.body) {
      if (visual && !side) {
        page.addShape("rect", {
          x: 0.85,
          y: bandTop,
          w: 0.06,
          h: 0.55,
          fill: { color: t.accent },
          line: { color: t.accent },
        });
        page.addText(slide.body, {
          x: 1.05,
          y: bandTop,
          w: 11.6,
          h: 0.55,
          fontFace: t.font,
          fontSize: 16,
          color: t.muted,
          valign: "middle",
          fit: "shrink",
        });
        bandTop += 0.7;
      } else if (visual && side) {
        // Placed under the bullets on the text side.
        page.addShape("roundRect", {
          x: textX,
          y: 5.0,
          w: textW,
          h: 1.4,
          rectRadius: 0.06,
          fill: { color: t.tint },
          line: { color: t.tint },
        });
        page.addText(slide.body, {
          x: textX + 0.2,
          y: 5.0,
          w: textW - 0.4,
          h: 1.4,
          fontFace: t.font,
          fontSize: 16,
          color: t.primary,
          valign: "middle",
          fit: "shrink",
        });
      } else {
        // Text-only slide: a tinted panel on the right keeps the page balanced.
        const y = hasBullets ? 1.9 : 2.2;
        page.addShape("roundRect", {
          x: hasBullets ? 8.6 : 0.85,
          y,
          w: hasBullets ? 4.1 : 11.9,
          h: hasBullets ? 3.6 : 2.4,
          rectRadius: 0.08,
          fill: { color: t.tint },
          line: { color: t.tint },
        });
        page.addShape("rect", {
          x: hasBullets ? 8.6 : 0.85,
          y,
          w: 0.08,
          h: hasBullets ? 3.6 : 2.4,
          fill: { color: t.accent },
          line: { color: t.accent },
        });
        page.addText(slide.body, {
          x: (hasBullets ? 8.6 : 0.85) + 0.3,
          y,
          w: (hasBullets ? 4.1 : 11.9) - 0.5,
          h: hasBullets ? 3.6 : 2.4,
          fontFace: t.font,
          fontSize: hasBullets ? 18 : 24,
          color: t.primary,
          valign: "middle",
          fit: "shrink",
        });
      }
    }

    if (visual) {
      if (side) {
        const card: Box = hasBullets
          ? { x: figX, y: 1.9, w: 5.9, h: 4.55 }
          : { x: 0.85, y: 1.9, w: 11.9, h: 4.55 };
        page.addShape("roundRect", {
          x: card.x,
          y: card.y,
          w: card.w,
          h: card.h,
          rectRadius: 0.06,
          fill: { color: "FFFFFF" },
          line: { color: t.line, width: 1 },
        });
        drawVisual(
          page,
          visual,
          { x: card.x + 0.2, y: card.y + 0.2, w: card.w - 0.4, h: card.h - 0.4 },
          images,
          t,
        );
      } else {
        const y = Math.min(Math.max(bandTop, 2.2), 4.4);
        drawVisual(page, visual, { x: 0.85, y, w: 11.9, h: 6.5 - y }, images, t);
      }
    }

    if (slide.source) {
      page.addText(slide.source, {
        x: 0.85,
        y: 6.55,
        w: 11.5,
        h: 0.3,
        fontFace: t.font,
        fontSize: 12,
        color: t.muted,
        valign: "middle",
        fit: "shrink",
      });
    }
    // Footer: deck title on the left, page number on the right.
    page.addShape("rect", {
      x: 0.6,
      y: 6.98,
      w: 12.1,
      h: 0.01,
      fill: { color: t.line },
      line: { color: t.line },
    });
    page.addText(spec.title, {
      x: 0.6,
      y: 7.03,
      w: 9,
      h: 0.3,
      fontFace: t.font,
      fontSize: 10,
      color: t.muted,
      valign: "middle",
    });
    page.addText(String(index + 2), {
      x: 11.7,
      y: 7.03,
      w: 1.0,
      h: 0.3,
      fontFace: t.font,
      fontSize: 10,
      color: t.muted,
      align: "right",
      valign: "middle",
    });
    if (slide.notes) page.addNotes(slide.notes);
  });

  const output = await pptx.write({ outputType: "uint8array" });
  return output as Uint8Array;
}
