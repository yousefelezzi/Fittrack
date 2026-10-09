/**
 * Calories from steps, for the dynamic calorie goal.
 *
 * Walking burns kg × steps ÷ 3,054 kcal: 10,000 steps ≈ 240 kcal at 73 kg,
 * 262 at 80 kg, 285 at 87 kg.
 *
 * With the dynamic goal on, every step counts from the first one: the goal's
 * base (BMR × 1.1, see nutritionTargets.js) has no walking in it. With it off,
 * steps don't change the goal at all; the activity level covers the user's
 * movement.
 */
const DEFAULT_STEP_GOAL = 10000;
const STEPS_PER_KCAL_PER_KG = 3054; // kcal = kg × steps ÷ 3,054

/** All kcal burned walking `steps` (0 if there's no weight to work from). */
function stepBurn(user, steps) {
  if (!user?.weight || !(steps > 0)) return 0;
  return Math.round((user.weight * steps) / STEPS_PER_KCAL_PER_KG);
}

/** Kcal `steps` add to the day's calorie goal: all of them with the dynamic goal on, none with it off. */
function stepCalories(user, steps) {
  return user?.adaptiveCalories === false ? 0 : stepBurn(user, steps);
}

module.exports = { stepCalories, stepBurn, DEFAULT_STEP_GOAL, STEPS_PER_KCAL_PER_KG };
