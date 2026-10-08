/**
 * Body-composition / energy-expenditure calculators.
 * All math takes metric inputs (kg, cm, years) to match the rest of the app.
 */

// ── FFMI (Fat-Free Mass Index) ──────────────────────────────────────────────

/**
 * @param {number} weightKg
 * @param {number} heightCm
 * @param {number} bodyFatPct
 * @returns {{ ffm: number, ffmi: number, normalizedFfmi: number }}
 */
export function calcFFMI(weightKg, heightCm, bodyFatPct) {
  const heightM = heightCm / 100;
  const ffm = weightKg * (1 - bodyFatPct / 100);
  const ffmi = ffm / (heightM * heightM);
  // Normalizes to a 1.8m (5'11") reference height so people of different
  // heights can be compared on the same scale.
  const normalizedFfmi = ffmi + 6.1 * (1.8 - heightM);
  return { ffm, ffmi, normalizedFfmi };
}

/** Men's thresholds; women's natural FFMI runs about 3 points lower (same shift as training level on the server). */
export const FFMI_FEMALE_OFFSET = 3;
export const FFMI_CATEGORIES = [
  { max: 18, label: 'Below average' },
  { max: 20, label: 'Average' },
  { max: 22, label: 'Above average' },
  { max: 23, label: 'Excellent' },
  { max: 26, label: 'Superior' },
  { max: 28, label: 'Suspicion of enhancement' },
  { max: Infinity, label: 'Very unlikely natural' },
];

/** The FFMI category for a normalized FFMI; `sex` 'female' uses the women's thresholds. */
export function ffmiCategory(normalizedFfmi, sex = 'male') {
  const shift = sex === 'female' ? FFMI_FEMALE_OFFSET : 0;
  return FFMI_CATEGORIES.find((c) => normalizedFfmi < c.max - shift)?.label ?? 'Superior';
}

/** Where the FFMI scale bar starts and ends for a sex, and its labelled marks. */
export function ffmiScale(sex = 'male') {
  const shift = sex === 'female' ? FFMI_FEMALE_OFFSET : 0;
  const min = 14 - shift;
  return { min, max: 30 - shift, marks: [0, 4, 8, 12, 16].map((n) => min + n) };
}

// ── BMR (Basal Metabolic Rate) — Mifflin-St Jeor equation ──────────────────

/**
 * @param {number} weightKg
 * @param {number} heightCm
 * @param {number} age
 * @param {'male'|'female'} sex
 * @returns {number} BMR in kcal/day
 */
export function calcBMR(weightKg, heightCm, age, sex) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

// ── TDEE (Total Daily Energy Expenditure) ───────────────────────────────────

export const ACTIVITY_LEVELS = [
  { value: 1.2,   label: 'Sedentary',       hint: 'Little or no exercise' },
  { value: 1.375, label: 'Lightly active',  hint: 'Exercise 1–3 days/week' },
  { value: 1.55,  label: 'Moderately active', hint: 'Exercise 3–5 days/week' },
  { value: 1.725, label: 'Very active',     hint: 'Exercise 6–7 days/week' },
  { value: 1.9,   label: 'Extremely active', hint: 'Hard daily exercise or physical job' },
];

/**
 * @param {number} bmr
 * @param {number} activityMultiplier one of ACTIVITY_LEVELS[].value
 * @returns {number} TDEE in kcal/day
 */
export function calcTDEE(bmr, activityMultiplier) {
  return bmr * activityMultiplier;
}

// ── One-rep max ─────────────────────────────────────────────────────────────

/**
 * Estimated one-rep max, the same way as the rest of the app (server
 * utils/oneRepMax.js): reps in reserve count as reps (5 reps @ 1 RIR = a 6-rep
 * max), then the Epley formula; a true single (1 rep, 0 RIR) counts as-is.
 * Estimates get unreliable past ONE_RM_MAX_REPS.
 * @returns {number|null} in the same unit as `weight`
 */
export const ONE_RM_MAX_REPS = 12;
export function calcOneRepMax(weight, reps, rir = 0) {
  const w = Number(weight);
  const n = Number(reps);
  if (!(w > 0) || !(n > 0)) return null;
  const effective = n + (Number(rir) || 0);
  return effective === 1 ? w : w * (1 + effective / 30);
}

/**
 * What you could lift for 1–`maxReps` reps to failure from a 1RM (Epley the
 * other way round), with each as a % of the 1RM.
 * @returns [{ reps, weight, percent }]
 */
export function repMaxTable(oneRepMax, maxReps = ONE_RM_MAX_REPS) {
  return Array.from({ length: maxReps }, (_, i) => {
    const reps = i + 1;
    const weight = reps === 1 ? oneRepMax : oneRepMax / (1 + reps / 30);
    return { reps, weight, percent: Math.round((weight / oneRepMax) * 100) };
  });
}
