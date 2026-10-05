const COLUMNS = [['kcal', 'calories', ''], ['Protein', 'protein', 'g'], ['Carbs', 'carbs', 'g'], ['Fat', 'fat', 'g']];
// Flag a total that's more than this far off its target.
const OFF_TARGET = 0.1;

/** A day's calories and macros against its targets, with big misses flagged. */
export default function PlanTotals({ totals, targets }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {COLUMNS.map(([label, key, unit]) => {
        const off = targets ? (totals[key] - targets[key]) / targets[key] : 0;
        return (
          <div key={key} className="rounded-lg bg-gray-50 dark:bg-gray-800 py-1.5">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{Math.round(totals[key])}{unit}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}{targets ? ` / ${Math.round(targets[key])}${unit}` : ''}</p>
            {targets && Math.abs(off) > OFF_TARGET && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">{off > 0 ? '+' : ''}{Math.round(off * 100)}%</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
