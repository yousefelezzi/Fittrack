/**
 * Maintenance from the user's real results, for the dynamic calorie goal.
 *
 * Over the last 14 full days (today isn't over yet):
 *   weight change  = 7-day average weight at the end − at the start (14 days apart)
 *   daily balance  = weight change × 7,700 kcal per kg ÷ 14   (+ surplus, − deficit)
 *   maintenance    = average intake − daily balance   (what they actually burned)
 * Of that, the daily average of the steps walked (every step, from the first)
 * and of the workouts and cardio done is taken out, since each day's goal adds
 * back that day's own steps and workouts. Compared with BMR × 1.1, the rest is
 * `offset` (everyday movement, and how this person's body differs).
 *
 * Only used with enough data: food logged on at least MIN_FOOD_DAYS days (days
 * under MIN_DAY_KCAL look unfinished and are skipped) and at least
 * MIN_WEIGH_INS weigh-ins in each of the two weeks. As a
 * safety net against bad logging, the offset is limited to ±MAX_OFFSET kcal
 * and ±MAX_OFFSET_PCT of the base.
 */
const NutritionLog = require('../models/NutritionLog');
const WeightLog = require('../models/WeightLog');
const StepLog = require('../models/StepLog');
const { weeklyAverage, dayStart } = require('./bodyWeight');
const { stepBurn } = require('./steps');
const { formulaBmr, DYNAMIC_BASE } = require('./nutritionTargets');
const WorkoutSession = require('../models/WorkoutSession');
const { sessionCalories } = require('./workoutCalories');
const CardioSession = require('../models/CardioSession');
const { cardioCalories } = require('./cardio');

const DAYS = 14;
const KCAL_PER_KG = 7700;
const MIN_FOOD_DAYS = 10;
const MIN_DAY_KCAL = 1000;
const MIN_WEIGH_INS = 2;
const MAX_OFFSET = 1000;
const MAX_OFFSET_PCT = 0.4;
const DAY = 86400000;
const round10 = (n) => Math.round(n / 10) * 10;

/**
 * @param user  lean user with the nutritionTargets profile fields and _id
 * @param asOf  the user's today (the period ends the day before)
 * @returns {{ offset, measured, expected, avgIntake, weightChange, dailyBalance, foodDays, weighIns, workoutCalories, workouts } | { offset: 0, reason }}
 */
async function adaptiveMaintenance(user, asOf = new Date()) {
  const end = new Date(dayStart(asOf).getTime() - DAY);        // yesterday
  const start = new Date(end.getTime() - (DAYS - 1) * DAY);    // 14 days, start..end
  const startAvgDay = new Date(start.getTime() - DAY);         // 7-day average just before the period
  const weightFrom = new Date(startAvgDay.getTime() - 6 * DAY);

  const bmr = formulaBmr(user);
  if (!bmr) return { offset: 0, reason: 'profile' };
  const expectedBase = bmr * DYNAMIC_BASE;

  const [logs, before, weights, steps, sessions, cardio] = await Promise.all([
    NutritionLog.find({ user: user._id, date: { $gte: start, $lte: new Date(end.getTime() + DAY - 1) } })
      .select('date meals.calories').lean(),
    WeightLog.findOne({ user: user._id, date: { $lt: weightFrom } }).sort({ date: -1 }).lean(),
    WeightLog.find({ user: user._id, date: { $gte: weightFrom, $lte: end } }).sort({ date: 1 }).lean(),
    StepLog.find({ user: user._id, date: { $gte: start, $lte: new Date(end.getTime() + DAY - 1) } }).select('steps').lean(),
    WorkoutSession.find({ user: user._id, date: { $gte: start, $lte: new Date(end.getTime() + DAY - 1) } })
      .select('duration exercises.sets.reps exercises.sets.duration exercises.sets.bursts exercises.sets.burstSeconds exercises.sets.burstRest exercises.sets.restTime').lean(),
    CardioSession.find({ user: user._id, date: { $gte: start, $lte: new Date(end.getTime() + DAY - 1) } }).select('activity intensity minutes').lean(),
  ]);

  // Workouts and cardio: the calories above resting, per day of the period.
  const workoutCalories = (sessions.reduce((n, s) => n + sessionCalories(s, user.weight).net, 0)
    + cardio.reduce((n, c) => n + cardioCalories(c, user.weight).net, 0)) / DAYS;
  const workoutInfo = { workoutCalories: Math.round(workoutCalories), workouts: sessions.length, cardio: cardio.length };
  // Steps, all of them; days with none logged count as the average logged day.
  const logged = steps.filter((s) => s.steps > 0);
  const avgSteps = logged.length ? logged.reduce((n, s) => n + s.steps, 0) / logged.length : null;
  const avgStepCalories = logged.length ? logged.reduce((n, s) => n + stepBurn(user, s.steps), 0) / logged.length : 0;

  // Intake: days that look fully logged.
  const intakes = logs.map((l) => l.meals.reduce((n, m) => n + (m.calories || 0), 0)).filter((k) => k >= MIN_DAY_KCAL);
  if (intakes.length < MIN_FOOD_DAYS) return { offset: 0, reason: 'food', foodDays: intakes.length, needed: MIN_FOOD_DAYS, ...workoutInfo };

  // Weight: enough weigh-ins in the week before the period and its last week.
  const inWeek = (from, to) => weights.filter((w) => w.date >= from && w.date <= to).length;
  const firstWeek = inWeek(weightFrom, startAvgDay);
  const lastWeek = inWeek(new Date(end.getTime() - 6 * DAY), end);
  if (firstWeek < MIN_WEIGH_INS || lastWeek < MIN_WEIGH_INS) {
    return { offset: 0, reason: 'weight', weighIns: [firstWeek, lastWeek], needed: MIN_WEIGH_INS, ...workoutInfo };
  }
  const all = before ? [before, ...weights] : weights;
  const startWeight = weeklyAverage(all, startAvgDay);
  const endWeight = weeklyAverage(all, end);
  const weightChange = Math.round((endWeight - startWeight) * 100) / 100;

  const avgIntake = intakes.reduce((a, b) => a + b, 0) / intakes.length;
  const dailyBalance = (weightChange * KCAL_PER_KG) / DAYS;
  const measured = avgIntake - dailyBalance;
  const expected = expectedBase + avgStepCalories + workoutCalories;

  const limit = Math.min(MAX_OFFSET, expectedBase * MAX_OFFSET_PCT);
  const offset = round10(Math.max(-limit, Math.min(limit, measured - expected)));
  return {
    offset,
    limited: Math.abs(measured - expected) > limit,
    measured: round10(measured),
    expected: round10(expected),
    avgIntake: Math.round(avgIntake),
    weightChange,
    dailyBalance: Math.round(dailyBalance),
    foodDays: intakes.length,
    weighIns: [firstWeek, lastWeek],
    avgSteps: avgSteps == null ? null : Math.round(avgSteps / 10) * 10,
    avgStepCalories: Math.round(avgStepCalories),
    ...workoutInfo,
  };
}

module.exports = { adaptiveMaintenance, KCAL_PER_KG, MIN_FOOD_DAYS, MIN_WEIGH_INS };
