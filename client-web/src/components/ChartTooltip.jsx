/**
 * Recharts tooltip in the app's style (same as the muscle pie chart): theme
 * background, border and text, so it reads in light and dark mode.
 *
 * Usage: <Tooltip content={<ChartTooltip format={(value, name, point) => [text, label]} />} cursor={CHART_CURSOR} />
 * Points with no value are left out. `title(label, point)` can replace the heading.
 */
export const CHART_CURSOR = { fill: 'var(--chart-grid, #e2e8f0)', opacity: 0.4 };

export default function ChartTooltip({ active, payload, label, format, title }) {
  const rows = (payload || []).filter((p) => p.value != null);
  if (!active || !rows.length) return null;
  const point = rows[0].payload;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs shadow-sm"
      style={{ backgroundColor: 'var(--tooltip-bg, #fff)', borderColor: 'var(--tooltip-border, #e5e7eb)', color: 'var(--tooltip-text, #111)' }}>
      <p className="font-semibold">{title ? title(label, point) : label}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((p) => {
          const [text, name] = format ? format(p.value, p.dataKey, point) : [p.value, p.name];
          return (
            <li key={p.dataKey} className="flex justify-between gap-4">
              <span className="opacity-80">{name}</span>
              <span className="tabular-nums font-medium">{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
