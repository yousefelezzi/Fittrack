const StepLog = require('../models/StepLog');
const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');
const { stepCalories, stepBurn, baselineSteps, DEFAULT_STEP_GOAL } = require('../utils/steps');
const { syncGoals } = require('./nutrition.controller');

const startOfDay = (date) => { const d = new Date(date); d.setHours(0,0,0,0); return d; };
const endOfDay   = (date) => { const d = new Date(date); d.setHours(23,59,59,999); return d; };
const sameDay    = (date) => ({ $gte: startOfDay(date), $lte: endOfDay(date) });

const USER_FIELDS = 'weight activityLevel stepGoal';

// What the client needs to explain the numbers: the goal, and from how many
// steps a day starts adding to the calorie target.
const settingsFor = (user) => ({
  goal: user?.stepGoal || DEFAULT_STEP_GOAL,
  baseline: baselineSteps(user?.activityLevel),
  canAdjustCalories: !!user?.weight,
});

const entryFor = (log, user) => ({
  _id: log._id,
  date: log.date,
  steps: log.steps,
  calories: stepCalories(user, log.steps), // added to the day's calorie target
  burned: stepBurn(user, log.steps),        // all calories burned walking them
});

// GET /api/steps?from=2024-01-01&to=2024-01-31  — entries in the range (oldest first)
exports.getSteps = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from and to dates are required' });
    const [user, logs] = await Promise.all([
      User.findById(req.user.id).select(USER_FIELDS).lean(),
      StepLog.find({ user: req.user.id, date: { $gte: startOfDay(from), $lte: endOfDay(to) } }).sort({ date: 1 }).lean(),
    ]);
    res.json({ ...settingsFor(user), days: logs.map((l) => entryFor(l, user)) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/steps/sync  { days: [{ date, steps }] }  — counts from the phone or
// its health app. A day only ever goes up: a higher count already saved (typed
// in, or from another device) is kept.
exports.syncSteps = async (req, res, next) => {
  try {
    const days = req.body.days.filter((d) => d.steps > 0);
    if (days.length) {
      await StepLog.bulkWrite(days.map((d) => {
        const date = new Date(d.date);
        return {
          updateOne: {
            filter: { user: req.user.id, date: sameDay(date) },
            update: { $max: { steps: Math.round(d.steps) }, $setOnInsert: { user: req.user.id, date } },
            upsert: true,
          },
        };
      }));
      // Today's calorie target depends on today's steps (syncGoals leaves past days alone).
      const latest = new Date(Math.max(...days.map((d) => new Date(d.date).getTime())));
      await syncGoals(await NutritionLog.findOne({ user: req.user.id, date: sameDay(latest) }), req.user.id);
    }
    res.json({ synced: days.length });
  } catch (err) {
    next(err);
  }
};

// PUT /api/steps  { date, steps }  — set a day's steps (0 removes the entry)
exports.setSteps = async (req, res, next) => {
  try {
    const date = new Date(req.body.date);
    const steps = Math.round(Number(req.body.steps));
    let log = null;
    if (steps > 0) {
      log = await StepLog.findOneAndUpdate(
        { user: req.user.id, date: sameDay(date) },
        { $set: { steps }, $setOnInsert: { user: req.user.id, date } },
        { new: true, upsert: true, runValidators: true }
      );
    } else {
      await StepLog.deleteOne({ user: req.user.id, date: sameDay(date) });
    }

    // Today's calorie target depends on today's steps.
    const nutrition = await NutritionLog.findOne({ user: req.user.id, date: sameDay(date) });
    await syncGoals(nutrition, req.user.id);

    const user = await User.findById(req.user.id).select(USER_FIELDS).lean();
    res.json({ ...settingsFor(user), entry: log ? entryFor(log, user) : null });
  } catch (err) {
    next(err);
  }
};
