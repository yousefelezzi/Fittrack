/**
 * Personalized daily nutrition targets from a user's profile.
 *
 * Calories: Mifflin-St Jeor BMR × activity multiplier = maintenance (TDEE),
 * then adjusted for the user's fitness goal. Same BMR/TDEE math as the
 * BMR & TDEE calculator page (client-web/src/utils/calculators.js).
 * That's all with the dynamic goal off: a plain calculator from the profile
 * and the chosen activity level, with no steps, cardio or workouts.
 *
 * The dynamic goal (on by default) takes over once there are 2 weeks of data
 * (utils/adaptiveCalories.js); until then the goal stays the calculator one.
 * Then the activity level isn't used:
 *   maintenance = what the user's weight change says they burn (food eaten
 *                 minus the surplus or deficit), minus the daily average of
 *                 the steps, workouts and cardio they did in those two weeks
 * and each day gets back what it actually has: that day's steps (from the
 * first step) and that day's workouts and cardio (the extra goes to carbs and
 * fat). Training or walking less lowers that day's goal.
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

const SEDENTARY = 1.2; // BMR × 1.2: resting plus everyday movement, no exercise
const DYNAMIC_BASE = 1.1; // BMR × 1.1: resting and digesting; the dynamic goal adds each day's steps and workouts

/** Mifflin-St Jeor BMR (kcal), or null if the profile is missing something. */
function formulaBmr(user) {
  if (!user?.weight || !user?.height || !user?.dateOfBirth || !user?.sex) return null;
  return 10 * user.weight + 6.25 * user.height - 5 * ageFrom(user.dateOfBirth) + (user.sex === 'female' ? -161 : 5);
}

/** BMR × activity (kcal), or null if the profile is missing something. */
function formulaMaintenance(user) {
  const bmr = formulaBmr(user);
  if (bmr == null) return null;
  const activity = ACTIVITY_LEVELS.includes(user.activityLevel) ? user.activityLevel : DEFAULT_ACTIVITY;
  return bmr * activity;
}

/**
 * @param opts.steps     steps walked that day, if logged
 * @param opts.workouts  kcal (above resting) from that day's workouts and cardio
 * @param opts.adaptive  result of adaptiveMaintenance(): its `offset` (kcal) is
 *                       added to maintenance before the goal is applied
 * @returns {{ targets: {calories, protein, carbs, fat} | null, missing: string[], basis?: object }}
 */
function nutritionTargets(user, { steps, workouts, adaptive } = {}) {
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
  // Dynamic (turned on, and 2 weeks of data): from the weight change, without
  // the period's steps and workouts, which are added back per day below.
  // Otherwise the calculator: BMR × activity level.
  const wanted = user.adaptiveCalories !== false;
  const dynamic = wanted && !!adaptive && adaptive.offset != null && !adaptive.reason;
  const maintenance = dynamic ? bmr * DYNAMIC_BASE + adaptive.offset : formula;

  let calories = maintenance * (1 + rule.calorieAdjust);
  const floored = calories < MIN_CALORIES[user.sex];
  if (floored) calories = MIN_CALORIES[user.sex];
  // Steps only count with the dynamic adjustment on.
  const fromSteps = dynamic ? stepCalories(user, steps) : 0;
  const fromWorkouts = dynamic ? Math.max(0, Math.round(workouts || 0)) : 0;
  calories = Math.round((calories + fromSteps + fromWorkouts) / 10) * 10;

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
      dynamic,
      // Turned on but waiting for enough data: `adaptive` says what's missing.
      dynamicPending: wanted && !dynamic,
      adaptive: wanted ? adaptive || null : null,
      activityLevel: activity,
      activityAssumed: !ACTIVITY_LEVELS.includes(user.activityLevel),
      floored,
      steps: steps ?? null,
      stepCalories: fromSteps,
      workoutCalories: fromWorkouts,
    },
  };
}

module.exports = { nutritionTargets, formulaMaintenance, formulaBmr, SEDENTARY, DYNAMIC_BASE, ACTIVITY_LEVELS };
