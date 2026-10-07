/**
 * Nutrition progress: daily calories, macros and water over a period, from
 * GET /nutrition/summary. Shared by the web and mobile clients (mobile imports
 * it through its Metro config). Pure JS only.
 */

/** [key, label, unit] — what the chart can show. */
export const NUTRITION_METRICS = [
  ['calories', 'Calories', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
  ['water', 'Water', 'ml'],
];
export const NUTRITION_RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The from/to dates (YYYY-MM-DD) for the last `days` days, today included. */
export function rangeDates(days, today = new Date()) {
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(today) };
}

/**
 * One point per day of the period: { date, value, target }. `value` is null on
 * days with nothing logged for that metric (so the chart shows a gap, not 0).
 * The target is that day's goal (water: the daily water goal).
 */
export function dailySeries(summary, metric, days, today = new Date()) {
  const byDate = new Map((summary?.days || []).map((d) => [d.date, d]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const key = ymd(day);
    const d = byDate.get(key);
    const logged = d && (metric === 'water' ? d.water > 0 : d.calories > 0);
    out.push({
      date: key,
      value: logged ? d[metric] : null,
      target: metric === 'water' ? summary?.waterGoal ?? null : d?.goals?.[metric] ?? null,
    });
  }
  return out;
}

/**
 * Average over logged days, and how many of them hit the target: calories
 * within 10% of the goal; protein and water at or above it; carbs and fat at
 * or below it.
 */
export function seriesStats(series, metric) {
  const logged = series.filter((p) => p.value != null);
  const avg = logged.length ? Math.round(logged.reduce((n, p) => n + p.value, 0) / logged.length) : null;
  const hit = (p) => {
    if (!p.target) return false;
    if (metric === 'calories') return Math.abs(p.value - p.target) <= p.target * 0.1;
    if (metric === 'protein' || metric === 'water') return p.value >= p.target;
    return p.value <= p.target;
  };
  const withTarget = logged.filter((p) => p.target);
  return { average: avg, daysLogged: logged.length, onTarget: withTarget.filter(hit).length, daysWithTarget: withTarget.length };
}

/** "On target" wording per metric, for the stats line. */
export const TARGET_RULE = {
  calories: 'within 10% of your goal',
  protein: 'at or above your goal',
  carbs: 'at or under your goal',
  fat: 'at or under your goal',
  water: 'at or above your goal',
};

/** "1.5 L" / "750 ml". */
export const formatMl = (ml) => (ml >= 1000 ? `${Math.round(ml / 100) / 10} L` : `${Math.round(ml)} ml`);

/** Quick-add amounts for water, in ml. */
export const WATER_PRESETS = [250, 330, 500, 750];
