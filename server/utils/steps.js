/**
 * Calories from steps, for raising the day's calorie target on active days.
 *
 * Walking burns about 0.00055 kcal per kg of body weight per step: 10,000
 * steps ≈ 400 kcal at 73 kg, 440 at 80 kg, 480 at 87 kg.
 *
 * The activity level describes exercise (gym days per week), on top of the
 * ×1.2 "sedentary" base, which already covers everyday movement — about 4,000
 * steps around the house, to the car and so on. So whatever the activity level,
 * steps beyond those 4,000 add to the day's target. Fewer never lower it — a
 * day's count is often logged before the day is over.
 *
 * E.g. 10,000 steps at 80 kg: ≈ 440 kcal burned, of which the first 4,000
 * (≈ 175) are already in maintenance, so the target goes up by ≈ 265.
 */
const DEFAULT_STEP_GOAL = 10000;
const KCAL_PER_STEP_PER_KG = 0.00055;
const BASELINE_STEPS = 4000; // everyday movement, already in the ×1.2 base

// Same for every activity level (kept as a function so callers don't depend on that).
const baselineSteps = () => BASELINE_STEPS;

/** All kcal burned walking `steps` (0 if there's no weight to work from). */
function stepBurn(user, steps) {
  if (!user?.weight || !(steps > 0)) return 0;
  return Math.round(steps * user.weight * KCAL_PER_STEP_PER_KG);
}

/** Extra kcal burned by `steps` beyond what the user's activity level assumes (0 if none or no weight). */
function stepCalories(user, steps) {
  if (!user?.weight || !(steps > 0)) return 0;
  const extra = Math.max(0, steps - baselineSteps(user.activityLevel));
  return Math.round(extra * user.weight * KCAL_PER_STEP_PER_KG);
}

module.exports = { stepCalories, stepBurn, baselineSteps, DEFAULT_STEP_GOAL, KCAL_PER_STEP_PER_KG };
