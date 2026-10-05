/**
 * Horizontal progress bar for a single macro nutrient.
 *
 * Props:
 *   label   — 'calories' | 'protein' | 'carbs' | 'fat'
 *   current — number (amount consumed)
 *   goal    — number (daily target)
 *   unit    — string shown after the numbers, default 'g'
 *   color   — optional Tailwind bg class for the filled bar, default brand blue
 */
export default function MacroBar({ label, current, goal, unit = 'g', color = 'bg-brand-500' }) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const over = pct >= 100;

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span className="capitalize">{label}</span>
        <span className={over ? 'text-orange-500 font-medium' : ''}>
          {current} / {goal} {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-orange-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}