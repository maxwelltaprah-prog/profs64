import { type DeckSpec, type Visual } from "@/lib/documents/spec";
import { themeFor, type Theme } from "@/lib/documents/themes";

// A slide drawn as SVG from the same outline and theme the .pptx is made from. SVG attributes (not
// style attributes) keep it inside the strict CSP, and it scales to any width. It is a close
// preview, not the file: PowerPoint lays text out slightly differently.
const W = 1333;
const H = 750;
const PX = 100 / 72; // points to viewBox units (100 units per inch)

function wrap(text: string, width: number, size: number, maxLines: number): string[] {
  const perLine = Math.max(8, Math.floor(width / (size * 0.5)));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > perLine) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = (kept[maxLines - 1] ?? "").replace(/.{1,2}$/, "") + "…";
    return kept;
  }
  return lines;
}

function Lines({
  text,
  x,
  y,
  width,
  pt,
  fill,
  bold = false,
  maxLines = 4,
  anchor = "start",
  t,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  pt: number;
  fill: string;
  bold?: boolean;
  maxLines?: number;
  anchor?: "start" | "middle";
  t: Theme;
}) {
  const size = pt * PX;
  return (
    <>
      {wrap(text, width, size, maxLines).map((line, i) => (
        <text
          key={i}
          x={anchor === "middle" ? x + width / 2 : x}
          y={y + size + i * size * 1.25}
          fontSize={size}
          fontFamily={`${t.font}, Arial, sans-serif`}
          fontWeight={bold ? 700 : 400}
          fill={fill}
          textAnchor={anchor}
        >
          {line}
        </text>
      ))}
    </>
  );
}

function Chart({
  visual,
  x,
  y,
  w,
  h,
  t,
}: {
  visual: Extract<Visual, { type: "chart" }>;
  x: number;
  y: number;
  w: number;
  h: number;
  t: Theme;
}) {
  const font = `${t.font}, Arial, sans-serif`;
  const top = visual.title ? 40 : 0;
  const cx = x + 50;
  const cy = y + top + 10;
  const cw = w - 70;
  const ch = h - top - 60;
  const values = visual.series.flatMap((s) => s.values);
  if (visual.kind === "pie" || visual.kind === "doughnut") {
    const data = (visual.series[0]?.values ?? []).map((v) => Math.max(0, v));
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(cw, ch) / 2;
    const mx = x + w / 2;
    const my = cy + ch / 2;
    return (
      <g>
        {visual.title ? (
          <text x={mx} y={y + 26} textAnchor="middle" fontSize={18} fontFamily={font} fill={t.ink}>
            {visual.title}
          </text>
        ) : null}
        {data.map((v, i) => {
          const before = data.slice(0, i).reduce((a, b) => a + b, 0);
          const angle = -Math.PI / 2 + (before / total) * Math.PI * 2;
          const a2 = angle + (v / total) * Math.PI * 2;
          const large = a2 - angle > Math.PI ? 1 : 0;
          const p = (a: number, rad: number) =>
            `${mx + Math.cos(a) * rad} ${my + Math.sin(a) * rad}`;
          const inner = visual.kind === "doughnut" ? r * 0.55 : 0;
          const d = `M ${p(angle, r)} A ${r} ${r} 0 ${large} 1 ${p(a2, r)} L ${p(a2, inner)} ${inner ? `A ${inner} ${inner} 0 ${large} 0 ${p(angle, inner)}` : ""} Z`;
          return (
            <path
              key={i}
              d={d}
              fill={t.series[i % t.series.length]}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          );
        })}
        {visual.categories.slice(0, data.length).map((c, i) => (
          <g key={c + i}>
            <rect
              x={x + 20 + i * 150}
              y={y + h - 28}
              width={14}
              height={14}
              fill={t.series[i % t.series.length]}
            />
            <text
              x={x + 40 + i * 150}
              y={y + h - 16}
              fontSize={15}
              fontFamily={font}
              fill={t.muted}
            >
              {c.slice(0, 14)}
            </text>
          </g>
        ))}
      </g>
    );
  }
  const max = Math.max(0, ...values) || 1;
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const yOf = (v: number) => cy + ch - ((v - min) / range) * ch;
  const n = visual.categories.length;
  const slot = cw / n;
  return (
    <g>
      {visual.title ? (
        <text
          x={x + w / 2}
          y={y + 26}
          textAnchor="middle"
          fontSize={18}
          fontFamily={font}
          fill={t.ink}
        >
          {visual.title}
        </text>
      ) : null}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={cx}
            x2={cx + cw}
            y1={cy + ch - f * ch}
            y2={cy + ch - f * ch}
            stroke={t.line}
            strokeWidth={1}
          />
          <text
            x={cx - 8}
            y={cy + ch - f * ch + 5}
            textAnchor="end"
            fontSize={13}
            fontFamily={font}
            fill={t.muted}
          >
            {Number((min + f * range).toPrecision(3))}
          </text>
        </g>
      ))}
      {visual.categories.map((c, i) => (
        <text
          key={c + i}
          x={cx + slot * i + slot / 2}
          y={cy + ch + 24}
          textAnchor="middle"
          fontSize={14}
          fontFamily={font}
          fill={t.muted}
        >
          {c.slice(0, 12)}
        </text>
      ))}
      {visual.kind === "bar"
        ? visual.series.map((s, si) => {
            const bw = (slot * 0.6) / visual.series.length;
            return s.values.slice(0, n).map((v, i) => (
              <g key={`${si}-${i}`}>
                <rect
                  x={cx + slot * i + slot * 0.2 + si * bw}
                  y={Math.min(yOf(v), yOf(0))}
                  width={bw}
                  height={Math.abs(yOf(v) - yOf(0))}
                  fill={t.series[si % t.series.length]}
                />
                {visual.series.length === 1 && n <= 8 ? (
                  <text
                    x={cx + slot * i + slot / 2}
                    y={Math.min(yOf(v), yOf(0)) - 6}
                    textAnchor="middle"
                    fontSize={13}
                    fontFamily={font}
                    fill={t.ink}
                  >
                    {v}
                  </text>
                ) : null}
              </g>
            ));
          })
        : visual.series.map((s, si) => (
            <g key={si}>
              <polyline
                fill="none"
                stroke={t.series[si % t.series.length]}
                strokeWidth={3}
                points={s.values
                  .slice(0, n)
                  .map((v, i) => `${cx + slot * i + slot / 2},${yOf(v)}`)
                  .join(" ")}
              />
              {s.values.slice(0, n).map((v, i) => (
                <circle
                  key={i}
                  cx={cx + slot * i + slot / 2}
                  cy={yOf(v)}
                  r={5}
                  fill={t.series[si % t.series.length]}
                />
              ))}
            </g>
          ))}
    </g>
  );
}

function VisualView({
  visual,
  box,
  t,
  images,
}: {
  visual: Visual;
  box: { x: number; y: number; w: number; h: number };
  t: Theme;
  images: Readonly<Record<string, string>>;
}) {
  const { x, y, w, h } = box;
  if (visual.type === "chart") return <Chart visual={visual} x={x} y={y} w={w} h={h} t={t} />;
  if (visual.type === "stats") {
    const n = visual.items.length;
    const gap = 30;
    const cw = (w - gap * (n - 1)) / n;
    const ch = Math.min(h, 240);
    const top = y + (h - ch) / 2;
    return (
      <g>
        {visual.items.map((item, i) => {
          const left = x + i * (cw + gap);
          return (
            <g key={i}>
              <rect
                x={left}
                y={top}
                width={cw}
                height={ch}
                rx={8}
                fill={t.surface}
                stroke={t.line}
              />
              <rect x={left} y={top} width={cw} height={6} fill={t.accent} />
              <Lines
                text={item.value}
                x={left + 24}
                y={top + 40}
                width={cw - 48}
                pt={44}
                fill={t.accent}
                bold
                maxLines={1}
                t={t}
              />
              <Lines
                text={item.label}
                x={left + 24}
                y={top + 130}
                width={cw - 48}
                pt={16}
                fill={t.muted}
                maxLines={3}
                t={t}
              />
            </g>
          );
        })}
      </g>
    );
  }
  if (visual.type === "process") {
    const n = visual.steps.length;
    const gap = 45;
    const cw = (w - gap * (n - 1)) / n;
    const ch = Math.min(h, 280);
    const top = y + (h - ch) / 2;
    return (
      <g>
        {visual.steps.map((step, i) => {
          const left = x + i * (cw + gap);
          return (
            <g key={i}>
              <rect
                x={left}
                y={top}
                width={cw}
                height={ch}
                rx={8}
                fill="#FFFFFF"
                stroke={t.line}
                strokeWidth={1.5}
              />
              <circle cx={left + 40} cy={top + 42} r={21} fill={t.accent} />
              <text
                x={left + 40}
                y={top + 49}
                textAnchor="middle"
                fontSize={20}
                fontWeight={700}
                fill="#FFFFFF"
                fontFamily={t.font}
              >
                {i + 1}
              </text>
              <Lines
                text={step.title}
                x={left + 20}
                y={top + 85}
                width={cw - 40}
                pt={18}
                fill={t.ink}
                bold
                maxLines={2}
                t={t}
              />
              {step.text ? (
                <Lines
                  text={step.text}
                  x={left + 20}
                  y={top + 150}
                  width={cw - 40}
                  pt={14}
                  fill={t.muted}
                  maxLines={4}
                  t={t}
                />
              ) : null}
              {i < n - 1 ? (
                <path
                  d={`M ${left + cw + 8} ${top + ch / 2 - 14} l ${gap - 16} 14 l -${gap - 16} 14 z`}
                  fill={t.muted}
                />
              ) : null}
            </g>
          );
        })}
      </g>
    );
  }
  if (visual.type === "timeline") {
    const n = visual.events.length;
    const slot = w / n;
    const lineY = y + h * 0.36;
    return (
      <g>
        <line x1={x} x2={x + w} y1={lineY} y2={lineY} stroke={t.line} strokeWidth={3} />
        {visual.events.map((e, i) => {
          const left = x + i * slot;
          return (
            <g key={i}>
              <Lines
                text={e.label}
                x={left}
                y={lineY - 62}
                width={slot - 20}
                pt={15}
                fill={t.accent}
                bold
                maxLines={1}
                t={t}
              />
              <circle
                cx={left + 12}
                cy={lineY}
                r={11}
                fill={t.accent}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <Lines
                text={e.title}
                x={left}
                y={lineY + 26}
                width={slot - 24}
                pt={18}
                fill={t.ink}
                bold
                maxLines={2}
                t={t}
              />
              {e.text ? (
                <Lines
                  text={e.text}
                  x={left}
                  y={lineY + 90}
                  width={slot - 24}
                  pt={14}
                  fill={t.muted}
                  maxLines={4}
                  t={t}
                />
              ) : null}
            </g>
          );
        })}
      </g>
    );
  }
  const src = images[visual.imageId];
  if (!src) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={t.surface} stroke={t.line} />
        <Lines
          text="Picture not available in the preview"
          x={x}
          y={y + h / 2 - 12}
          width={w}
          pt={14}
          fill={t.muted}
          anchor="middle"
          maxLines={1}
          t={t}
        />
      </g>
    );
  }
  return (
    <image
      href={src}
      x={x}
      y={y}
      width={w}
      height={h - (visual.caption ? 40 : 0)}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

export function SlideSvg({
  deck,
  index,
  images,
}: {
  deck: DeckSpec;
  /** -1 is the cover; 0 and up are the content slides. */
  index: number;
  images: Readonly<Record<string, string>>;
}) {
  const t = themeFor(deck);
  const font = `${t.font}, Arial, sans-serif`;
  if (index < 0) {
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Cover slide: ${deck.title}`}
        className="block w-full"
      >
        <rect width={W} height={H} fill={t.primary} />
        <rect width={35} height={H} fill={t.accent} />
        <Lines
          text={deck.title}
          x={100}
          y={200}
          width={1130}
          pt={44}
          fill="#FFFFFF"
          bold
          maxLines={3}
          t={t}
        />
        {t.academic ? null : <rect x={100} y={410} width={120} height={7} fill={t.accent} />}
        {deck.subtitle ? (
          <Lines
            text={deck.subtitle}
            x={100}
            y={440}
            width={1130}
            pt={22}
            fill="#D6E2F0"
            maxLines={2}
            t={t}
          />
        ) : null}
      </svg>
    );
  }
  const slide = deck.slides[index];
  if (!slide) return null;
  const visual = slide.visual;
  const side = visual?.type === "chart" || visual?.type === "image";
  const bullets = slide.bullets ?? [];
  const hasBullets = bullets.length > 0;
  const figureFirst = t.academic;
  const textX = figureFirst && visual && side && hasBullets ? 720 : 85;
  const textW =
    visual && side && hasBullets ? 550 : !visual && slide.body && hasBullets ? 740 : 1190;
  const compact = Boolean(visual) && !side;
  const bodyPt = compact ? 18 : visual && side ? 20 : t.academic ? 20 : 22;
  const rowH = bodyPt * PX * 1.25;
  let by = 190;
  const bulletNodes: React.ReactNode[] = [];
  bullets.slice(0, compact ? 4 : 8).forEach((b, i) => {
    const lines = wrap(b, textW - 30, bodyPt * PX, 3);
    bulletNodes.push(
      <g key={i}>
        <circle cx={textX + 6} cy={by + bodyPt * PX * 0.6} r={4} fill={t.ink} />
        <Lines
          text={b}
          x={textX + 28}
          y={by}
          width={textW - 30}
          pt={bodyPt}
          fill={t.ink}
          maxLines={3}
          t={t}
        />
      </g>,
    );
    by += lines.length * rowH + 14;
  });
  const band = Math.min(Math.max(compact ? by + 10 : 220, 220), 440);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Slide ${index + 2}: ${slide.title}`}
      className="block w-full"
    >
      <rect width={W} height={H} fill="#FFFFFF" />
      {t.academic ? (
        <rect x={60} y={160} width={1210} height={2} fill={t.line} />
      ) : (
        <rect x={55} y={50} width={9} height={95} fill={t.accent} />
      )}
      <Lines
        text={slide.title}
        x={t.academic ? 60 : 85}
        y={t.academic ? 60 : 58}
        width={1190}
        pt={slide.title.length > 70 ? 26 : 30}
        fill={t.primary}
        bold
        maxLines={2}
        t={t}
      />
      {bulletNodes}
      {slide.body && !visual ? (
        <g>
          <rect
            x={hasBullets ? 860 : 85}
            y={hasBullets ? 190 : 220}
            width={hasBullets ? 410 : 1190}
            height={hasBullets ? 360 : 240}
            rx={8}
            fill={t.tint}
          />
          <rect
            x={hasBullets ? 860 : 85}
            y={hasBullets ? 190 : 220}
            width={8}
            height={hasBullets ? 360 : 240}
            fill={t.accent}
          />
          <Lines
            text={slide.body}
            x={(hasBullets ? 860 : 85) + 30}
            y={hasBullets ? 290 : 300}
            width={(hasBullets ? 410 : 1190) - 60}
            pt={hasBullets ? 18 : 24}
            fill={t.primary}
            maxLines={6}
            t={t}
          />
        </g>
      ) : null}
      {slide.body && visual && side ? (
        <g>
          <rect x={textX} y={500} width={textW} height={140} rx={6} fill={t.tint} />
          <Lines
            text={slide.body}
            x={textX + 20}
            y={525}
            width={textW - 40}
            pt={16}
            fill={t.primary}
            maxLines={4}
            t={t}
          />
        </g>
      ) : null}
      {slide.body && visual && !side ? (
        <g>
          <rect x={85} y={band} width={6} height={55} fill={t.accent} />
          <Lines
            text={slide.body}
            x={105}
            y={band + 14}
            width={1160}
            pt={16}
            fill={t.muted}
            maxLines={1}
            t={t}
          />
        </g>
      ) : null}
      {visual && side ? (
        <g>
          <rect
            x={hasBullets ? (figureFirst ? 60 : 690) : 85}
            y={190}
            width={hasBullets ? 590 : 1190}
            height={455}
            rx={6}
            fill="#FFFFFF"
            stroke={t.line}
          />
          <VisualView
            visual={visual}
            box={{
              x: (hasBullets ? (figureFirst ? 60 : 690) : 85) + 20,
              y: 210,
              w: (hasBullets ? 590 : 1190) - 40,
              h: 415,
            }}
            t={t}
            images={images}
          />
        </g>
      ) : null}
      {visual && !side ? (
        <VisualView
          visual={visual}
          box={{
            x: 85,
            y: Math.min(Math.max(slide.body ? band + 70 : band, 220), 440),
            w: 1190,
            h: 650 - Math.min(Math.max(slide.body ? band + 70 : band, 220), 440),
          }}
          t={t}
          images={images}
        />
      ) : null}
      {slide.source ? (
        <text x={85} y={678} fontSize={12 * PX} fontFamily={font} fill={t.muted}>
          {slide.source.slice(0, 150)}
        </text>
      ) : null}
      <rect x={60} y={698} width={1210} height={1} fill={t.line} />
      <text x={60} y={728} fontSize={10 * PX} fontFamily={font} fill={t.muted}>
        {deck.title.slice(0, 80)}
      </text>
      <text x={1270} y={728} textAnchor="end" fontSize={10 * PX} fontFamily={font} fill={t.muted}>
        {index + 2}
      </text>
    </svg>
  );
}
