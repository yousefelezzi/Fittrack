/**
 * Personalized daily nutrition targets from a user's profile.
 *
 * Calories: Mifflin-St Jeor BMR × activity multiplier = maintenance (TDEE),
 * then adjusted for the user's fitness goal. Same BMR/TDEE math as the
 * BMR & TDEE calculator page (client-web/src/utils/calculators.js).
 * On days with more steps than the activity level assumes, the calories they
 * burn are added on top (see utils/steps.js); the extra goes to carbs and fat.
 * With `adaptive` (utils/adaptiveCalories.js), maintenance is corrected by how
 * the user's weight actually moved over the last two weeks.
 */
const { stepCalories } = require('./steps');

const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725, 1.9];
const DEFAULT_ACTIVITY = 1.55; // "moderately active" when the user hasn't picked one

// calorieAdjust: fraction of maintenance to add/subtract.
// proteinPerKg:  g of protein per kg bodyweight — higher in a deficit to hold on to muscle.
// fatPct:        share of calories from fat; carbs fill whatever is left.
const GOAL_RULES = {
  lose_weight:       { calorieAdjust: -0.20, proteinPerKg: 2.0, fatPct: 0.25, label: '20% deficit' },
  build_muscle:      { calorieAdjust: +0.10, proteinPerKg: 1.8, fatPct: 0.25, label: '10% surplus' },
  improve_endurance: { calorieAdjust:  0,    proteinPerKg: 1.4, fatPct: 0.25, label: 'maintenance' },
  stay_active:       { calorieAdjust:  0,    proteinPerKg: 1.6, fatPct: 0.30, label: 'maintenance' },
  other:             { calorieAdjust:  0,    proteinPerKg: 1.6, fatPct: 0.30, label: 'maintenance' },
};

// Don't recommend a deficit below these, whatever the maths says.
const MIN_CALORIES = { male: 1500, female: 1200 };

function ageFrom(dob) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

/** BMR × activity (kcal), or null if the profile is missing something. */
function formulaMaintenance(user) {
  if (!user?.weight || !user?.height || !user?.dateOfBirth || !user?.sex) return null;
  const activity = ACTIVITY_LEVELS.includes(user.activityLevel) ? user.activityLevel : DEFAULT_ACTIVITY;
  const bmr = 10 * user.weight + 6.25 * user.height - 5 * ageFrom(user.dateOfBirth) + (user.sex === 'female' ? -161 : 5);
  return bmr * activity;
}

/**
 * @param opts.steps     steps walked that day, if logged
 * @param opts.adaptive  result of adaptiveMaintenance(): its `offset` (kcal) is
 *                       added to maintenance before the goal is applied
 * @returns {{ targets: {calories, protein, carbs, fat} | null, missing: string[], basis?: object }}
 */
function nutritionTargets(user, { steps, adaptive } = {}) {
  const missing = [];
  if (!user?.weight) missing.push('weight');
  if (!user?.height) missing.push('height');
  if (!user?.dateOfBirth) missing.push('dateOfBirth');
  if (!user?.sex) missing.push('sex');
  if (missing.length) return { targets: null, missing };

  const age = ageFrom(user.dateOfBirth);
  const activity = ACTIVITY_LEVELS.includes(user.activityLevel) ? user.activityLevel : DEFAULT_ACTIVITY;
  const rule = GOAL_RULES[user.fitnessGoal] || GOAL_RULES.stay_active;

  const bmr = 10 * user.weight + 6.25 * user.height - 5 * age + (user.sex === 'female' ? -161 : 5);
  const formula = bmr * activity;
  // Corrected by the user's real weight trend when there's enough data.
  const offset = adaptive?.offset || 0;
  const maintenance = formula + offset;

  let calories = maintenance * (1 + rule.calorieAdjust);
  const floored = calories < MIN_CALORIES[user.sex];
  if (floored) calories = MIN_CALORIES[user.sex];
  const fromSteps = stepCalories(user, steps);
  calories = Math.round((calories + fromSteps) / 10) * 10;

  const protein = Math.round(user.weight * rule.proteinPerKg);
  const fat = Math.round((calories * rule.fatPct) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    targets: { calories, protein, carbs, fat },
    missing: [],
    basis: {
      goal: user.fitnessGoal || 'stay_active',
      adjustment: rule.label,
      maintenance: Math.round(maintenance / 10) * 10,
      formulaMaintenance: Math.round(formula / 10) * 10,
      adaptive: adaptive || null,
      activityLevel: activity,
      activityAssumed: !ACTIVITY_LEVELS.includes(user.activityLevel),
      floored,
      steps: steps ?? null,
      stepCalories: fromSteps,
    },
  };
}

module.exports = { nutritionTargets, formulaMaintenance, ACTIVITY_LEVELS };
