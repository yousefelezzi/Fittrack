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

const MACROS = [['protein', 'Protein', 4], ['carbs', 'Carbs', 4], ['fat', 'Fat', 9]];

/** Each macro's share of the calories in { protein, carbs, fat } grams: [{ key, label, grams, kcal, pct }]. */
export function macroSplit(grams) {
  const rows = MACROS.map(([key, label, perGram]) => ({ key, label, grams: grams?.[key] || 0, kcal: (grams?.[key] || 0) * perGram }));
  const total = rows.reduce((n, m) => n + m.kcal, 0);
  return rows.map((m) => ({ ...m, pct: total ? Math.round((m.kcal / total) * 100) : 0 }));
}

/**
 * Average macros over the days with food logged in the period, as a share of
 * calories: { daysLogged, kcal, slices: macroSplit of the average grams,
 * saturated: { grams, kcal, pct } (part of the fat), goal: macroSplit of the
 * latest day's goals (or null) }.
 */
export function averageMacros(summary) {
  const logged = (summary?.days || []).filter((d) => d.calories > 0);
  if (!logged.length) return { daysLogged: 0, kcal: 0, slices: macroSplit(null), saturated: { grams: 0, kcal: 0, pct: 0 }, goal: null };
  const avg = (k) => logged.reduce((n, d) => n + (d[k] || 0), 0) / logged.length;
  const grams = { protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') };
  const goals = [...(summary.days || [])].reverse().find((d) => d.goals?.protein && d.goals?.carbs && d.goals?.fat)?.goals;
  const slices = macroSplit(grams);
  const macroKcal = slices.reduce((n, m) => n + m.kcal, 0);
  const satGrams = Math.min(avg('saturatedFat'), grams.fat);
  return {
    daysLogged: logged.length,
    kcal: Math.round(avg('calories')),
    slices,
    saturated: { grams: satGrams, kcal: satGrams * 9, pct: macroKcal ? Math.round((satGrams * 9 / macroKcal) * 100) : 0 },
    goal: goals ? macroSplit(goals) : null,
  };
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
  const walked = adaptive.avgSteps != null
    ? ` That already allows for the ${adaptive.avgSteps.toLocaleString()} steps a day you walked; each day's goal adds that day's own steps, so walking less lowers it.`
    : '';
  return `Over the last 2 weeks you ate about ${adaptive.avgIntake.toLocaleString()} kcal a day and your weight ${moved} (${balance}), ${verdict}${walked}`;
}
