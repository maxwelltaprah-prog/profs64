import { type DayPoint } from "@/lib/workspace/usage";

// A minimal bar chart of daily credit spend, drawn as inline SVG (no chart dependency, no inline
// styles). Bars use the accent colour; the busiest day is highlighted. Decorative, so hidden from
// assistive tech beyond a label — the figures are also listed on the page.
export function UsageChart({ data }: { data: readonly DayPoint[] }) {
  const width = 720;
  const height = 160;
  const gap = 2;
  const max = Math.max(0.1, ...data.map((d) => d.credits));
  const barWidth = (width - gap * (data.length - 1)) / data.length;
  const peak = data.reduce(
    (best, d) => (d.credits > best.credits ? d : best),
    data[0] ?? { date: "", credits: 0 },
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-40 w-full"
      role="img"
      aria-label={`Daily credit use over the last ${data.length} days`}
      preserveAspectRatio="none"
    >
      {data.map((point, index) => {
        const barHeight =
          point.credits > 0 ? Math.max(2, (point.credits / max) * (height - 18)) : 0;
        return (
          <rect
            key={point.date}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1.5}
            className={
              point.date === peak.date && point.credits > 0 ? "fill-accent" : "fill-hairline-strong"
            }
          />
        );
      })}
    </svg>
  );
}
