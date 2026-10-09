const StepLog = require('../models/StepLog');
const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');
const { stepCalories, stepBurn, DEFAULT_STEP_GOAL } = require('../utils/steps');
const { syncGoals } = require('./nutrition.controller');

const startOfDay = (date) => { const d = new Date(date); d.setHours(0,0,0,0); return d; };
const endOfDay   = (date) => { const d = new Date(date); d.setHours(23,59,59,999); return d; };
const sameDay    = (date) => ({ $gte: startOfDay(date), $lte: endOfDay(date) });

const USER_FIELDS = 'weight height dateOfBirth sex activityLevel fitnessGoal stepGoal adaptiveCalories';

/** 'on' (steps count), 'pending' (turned on, waiting for 2 weeks of data) or 'off'. */
async function dynamicState(user) {
  if (user?.adaptiveCalories === false) return 'off';
  const { adaptiveMaintenance } = require('../utils/adaptiveCalories');
  return (await adaptiveMaintenance(user)).reason ? 'pending' : 'on';
}

// What the client needs to explain the numbers: the goal, and whether steps
// count toward the calorie goal (only once the dynamic goal is active).
const settingsFor = (user, state) => ({
  goal: user?.stepGoal || DEFAULT_STEP_GOAL,
  dynamic: state,
  canAdjustCalories: !!user?.weight,
});

const entryFor = (log, user, state) => ({
  _id: log._id,
  date: log.date,
  steps: log.steps,
  calories: state === 'on' ? stepCalories(user, log.steps) : 0, // added to the day's calorie goal
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
    const state = await dynamicState(user);
    res.json({ ...settingsFor(user, state), days: logs.map((l) => entryFor(l, user, state)) });
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
    const state = await dynamicState(user);
    res.json({ ...settingsFor(user, state), entry: log ? entryFor(log, user, state) : null });
  } catch (err) {
    next(err);
  }
};
