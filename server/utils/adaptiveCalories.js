/**
 * Calorie goals adjusted to how the user's body actually responds.
 *
 * Over the last 14 full days (today isn't over yet):
 *   weight change  = 7-day average weight at the end − at the start (14 days apart)
 *   daily balance  = weight change × 7,700 kcal per kg ÷ 14   (+ surplus, − deficit)
 *   measured maintenance = average intake − daily balance
 * The formula (BMR × activity, plus the calories from steps walked those days)
 * predicts a maintenance too; the difference is how far off it is for this
 * person, and that correction is added to their calorie goal.
 *
 * Only used with enough data: food logged on at least MIN_FOOD_DAYS days (days
 * under MIN_DAY_KCAL look unfinished and are skipped) and at least
 * MIN_WEIGH_INS weigh-ins in each of the two weeks. The correction is limited
 * to ±MAX_OFFSET kcal and ±MAX_OFFSET_PCT of the formula's maintenance.
 */
const NutritionLog = require('../models/NutritionLog');
const WeightLog = require('../models/WeightLog');
const StepLog = require('../models/StepLog');
const { weeklyAverage, dayStart } = require('./bodyWeight');
const { stepCalories } = require('./steps');
const { formulaMaintenance } = require('./nutritionTargets');

const DAYS = 14;
const KCAL_PER_KG = 7700;
const MIN_FOOD_DAYS = 10;
const MIN_DAY_KCAL = 1000;
const MIN_WEIGH_INS = 2;
const MAX_OFFSET = 750;
const MAX_OFFSET_PCT = 0.25;
const DAY = 86400000;
const round10 = (n) => Math.round(n / 10) * 10;

/**
 * @param user  lean user with the nutritionTargets profile fields and _id
 * @param asOf  the user's today (the period ends the day before)
 * @returns {{ offset, measured, expected, avgIntake, weightChange, dailyBalance, foodDays, weighIns } | { offset: 0, reason }}
 */
async function adaptiveMaintenance(user, asOf = new Date()) {
  const end = new Date(dayStart(asOf).getTime() - DAY);        // yesterday
  const start = new Date(end.getTime() - (DAYS - 1) * DAY);    // 14 days, start..end
  const startAvgDay = new Date(start.getTime() - DAY);         // 7-day average just before the period
  const weightFrom = new Date(startAvgDay.getTime() - 6 * DAY);

  const expectedBase = formulaMaintenance(user);
  if (!expectedBase) return { offset: 0, reason: 'profile' };

  const [logs, before, weights, steps] = await Promise.all([
    NutritionLog.find({ user: user._id, date: { $gte: start, $lte: new Date(end.getTime() + DAY - 1) } })
      .select('date meals.calories').lean(),
    WeightLog.findOne({ user: user._id, date: { $lt: weightFrom } }).sort({ date: -1 }).lean(),
    WeightLog.find({ user: user._id, date: { $gte: weightFrom, $lte: end } }).sort({ date: 1 }).lean(),
    StepLog.find({ user: user._id, date: { $gte: start, $lte: new Date(end.getTime() + DAY - 1) } }).select('steps').lean(),
  ]);

  // Intake: days that look fully logged.
  const intakes = logs.map((l) => l.meals.reduce((n, m) => n + (m.calories || 0), 0)).filter((k) => k >= MIN_DAY_KCAL);
  if (intakes.length < MIN_FOOD_DAYS) return { offset: 0, reason: 'food', foodDays: intakes.length, needed: MIN_FOOD_DAYS };

  // Weight: enough weigh-ins in the week before the period and its last week.
  const inWeek = (from, to) => weights.filter((w) => w.date >= from && w.date <= to).length;
  const firstWeek = inWeek(weightFrom, startAvgDay);
  const lastWeek = inWeek(new Date(end.getTime() - 6 * DAY), end);
  if (firstWeek < MIN_WEIGH_INS || lastWeek < MIN_WEIGH_INS) {
    return { offset: 0, reason: 'weight', weighIns: [firstWeek, lastWeek], needed: MIN_WEIGH_INS };
  }
  const all = before ? [before, ...weights] : weights;
  const startWeight = weeklyAverage(all, startAvgDay);
  const endWeight = weeklyAverage(all, end);
  const weightChange = Math.round((endWeight - startWeight) * 100) / 100;

  const avgIntake = intakes.reduce((a, b) => a + b, 0) / intakes.length;
  const dailyBalance = (weightChange * KCAL_PER_KG) / DAYS;
  const measured = avgIntake - dailyBalance;
  // The formula's maintenance for those days, with the calories from the steps walked.
  const avgStepCalories = steps.length ? steps.reduce((n, s) => n + stepCalories(user, s.steps), 0) / DAYS : 0;
  const expected = expectedBase + avgStepCalories;

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
  };
}

module.exports = { adaptiveMaintenance, KCAL_PER_KG, MIN_FOOD_DAYS, MIN_WEIGH_INS };
