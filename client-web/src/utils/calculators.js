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

export const FFMI_CATEGORIES = [
  { max: 18, label: 'Below average' },
  { max: 20, label: 'Average' },
  { max: 22, label: 'Above average' },
  { max: 23, label: 'Excellent' },
  { max: 26, label: 'Superior' },
  { max: 28, label: 'Suspicion of enhancement' },
  { max: Infinity, label: 'Very unlikely natural' },
];

export function ffmiCategory(normalizedFfmi) {
  return FFMI_CATEGORIES.find((c) => normalizedFfmi < c.max)?.label ?? 'Superior';
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
