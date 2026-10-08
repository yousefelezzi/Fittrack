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
 * Average over logged days, and how many of them hit the target: calories and
 * fat within 10% of the goal; protein, carbs and water at or above it.
 */
export function seriesStats(series, metric) {
  const logged = series.filter((p) => p.value != null);
  const avg = logged.length ? Math.round(logged.reduce((n, p) => n + p.value, 0) / logged.length) : null;
  const hit = (p) => {
    if (!p.target) return false;
    if (metric === 'calories' || metric === 'fat') return Math.abs(p.value - p.target) <= p.target * 0.1;
    return p.value >= p.target; // protein, carbs, water
  };
  const withTarget = logged.filter((p) => p.target);
  return { average: avg, daysLogged: logged.length, onTarget: withTarget.filter(hit).length, daysWithTarget: withTarget.length };
}

/** "On target" wording per metric, for the stats line. */
export const TARGET_RULE = {
  calories: 'within 10% of your goal',
  protein: 'at or above your goal',
  carbs: 'at or above your goal',
  fat: 'within 10% of your goal',
  water: 'at or above your goal',
};

/** "1.5 L" / "750 ml". */
export const formatMl = (ml) => (ml >= 1000 ? `${Math.round(ml / 100) / 10} L` : `${Math.round(ml)} ml`);

/** Quick-add amounts for water, in ml. */
export const WATER_PRESETS = [250, 330, 500, 750];

/**
 * What the calorie goal's weight-trend adjustment did, in words (targets
 * basis.adaptive from the server, utils/adaptiveCalories.js), or null when it's
 * off. Weight change in the user's unit ('kg' | 'lb').
 */
export function adaptiveText(adaptive, unit = 'kg') {
  if (!adaptive) return null;
  if (adaptive.reason === 'food') {
    return `To fine-tune your goal from your real results, log your food on at least ${adaptive.needed} of the last 14 days (${adaptive.foodDays} so far).`;
  }
  if (adaptive.reason === 'weight') {
    const [a, b] = adaptive.weighIns || [0, 0];
    return `To fine-tune your goal from your real results, weigh in at least ${adaptive.needed} times in each of the last two weeks (${a} and ${b} so far).`;
  }
  if (adaptive.reason) return null;
  const change = Math.abs(unit === 'lb' ? adaptive.weightChange / 0.45359237 : adaptive.weightChange);
  const moved = adaptive.weightChange < 0 ? `went down ${change.toFixed(1)} ${unit}` : adaptive.weightChange > 0 ? `went up ${change.toFixed(1)} ${unit}` : 'held steady';
  const balance = adaptive.dailyBalance < 0 ? `a ${Math.abs(adaptive.dailyBalance)} kcal daily deficit` : adaptive.dailyBalance > 0 ? `a ${adaptive.dailyBalance} kcal daily surplus` : 'no surplus or deficit';
  const verdict = adaptive.offset === 0
    ? 'which matches the formula, so no change.'
    : `so your maintenance looks ${Math.abs(adaptive.offset)} kcal ${adaptive.offset > 0 ? 'higher' : 'lower'} than the formula and your goal is adjusted${adaptive.limited ? ' (capped for now; it keeps adjusting as more data comes in)' : ''}.`;
  return `Over the last 2 weeks you ate about ${adaptive.avgIntake.toLocaleString()} kcal a day and your weight ${moved} (${balance}), ${verdict}`;
}
