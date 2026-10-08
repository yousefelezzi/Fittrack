/**
 * Body weight and height in the user's units, and the weigh-in series for the
 * Weight page. Shared by the web and mobile clients (mobile imports it through
 * its Metro config). Pure JS only.
 *
 * Stored in kg and cm. user.bodyWeightUnit is 'kg' | 'lb'; user.heightUnit is
 * 'cm' | 'ft' (feet and inches).
 */
import { KG_PER_LB } from './weightUnits';

const CM_PER_IN = 2.54;
const round1 = (n) => Math.round(n * 10) / 10;

/** kg → the unit, to one decimal. */
export const kgTo = (kg, unit) => (kg == null || kg === '' ? '' : round1(unit === 'lb' ? Number(kg) / KG_PER_LB : Number(kg)));
/** A weight typed in `unit` → kg (unrounded). */
export const toKgFrom = (value, unit) => (unit === 'lb' ? Number(value) * KG_PER_LB : Number(value));
/** "80.4 kg" / "177.2 lb". */
export const formatBodyWeight = (kg, unit = 'kg') => (kg == null || kg === '' ? '' : `${kgTo(kg, unit)} ${unit === 'lb' ? 'lb' : 'kg'}`);

/** cm → { ft, in } (whole inches). */
export function cmToFtIn(cm) {
  const total = Math.round(Number(cm) / CM_PER_IN);
  return { ft: Math.floor(total / 12), in: total % 12 };
}
/** Feet + inches → cm (one decimal). */
export const ftInToCm = (ft, inches) => round1(((Number(ft) || 0) * 12 + (Number(inches) || 0)) * CM_PER_IN);
/** "180 cm" / "5'11\"". */
export function formatHeight(cm, unit = 'cm') {
  if (!cm) return '';
  if (unit !== 'ft') return `${Math.round(cm)} cm`;
  const { ft, in: inches } = cmToFtIn(cm);
  return `${ft}'${inches}"`;
}

const DAY = 86400000;
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * One point per day for the last `days` days: { date, weight (that day's
 * weigh-in or null), average (7-day average, a missing day using the latest
 * weigh-in before it — same as the profile weight) }. `before` is the latest
 * weigh-in before the period, if any. Weights in kg.
 */
export function weightSeries(entries = [], before = null, days = 90, today = new Date()) {
  const all = [...(before ? [before] : []), ...entries].map((e) => ({ day: ymd(e.date), weight: e.weight }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const end = Date.parse(`${ymd(today)}T00:00:00Z`);
  // The value for each day of the period plus the 6 days before it (for the first averages).
  const carried = new Map();
  let i = 0;
  let latest = null;
  for (let t = end - (days + 5) * DAY; t <= end; t += DAY) {
    const key = ymd(t);
    while (i < all.length && all[i].day <= key) latest = all[i++].weight;
    carried.set(key, latest);
  }
  const logged = new Map(all.map((e) => [e.day, e.weight]));
  const out = [];
  for (let t = end - (days - 1) * DAY; t <= end; t += DAY) {
    const key = ymd(t);
    const window = [];
    for (let k = 6; k >= 0; k--) { const v = carried.get(ymd(t - k * DAY)); if (v != null) window.push(v); }
    out.push({
      date: key,
      weight: logged.get(key) ?? null,
      average: window.length ? Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 100) / 100 : null,
    });
  }
  return out;
}
