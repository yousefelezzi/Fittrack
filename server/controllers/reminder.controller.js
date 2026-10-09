/**
 * What the reminders need to know about the user's day: is it a workout day
 * (and have they trained yet), and how many of the day's supplements are
 * ticked off. Used by the web dashboard's reminder cards and by the phone app
 * to skip a notification that's no longer needed.
 */
const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');
const Supplement = require('../models/Supplement');
const WorkoutSession = require('../models/WorkoutSession');

const startOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
const endOfDay = (date) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; };

/** Counts for a day's supplements without changing anything (the stack counts until the day is opened). */
async function supplementCounts(userId, date) {
  const [log, stack] = await Promise.all([
    NutritionLog.findOne({ user: userId, date: { $gte: startOfDay(date), $lte: endOfDay(date) } }).select('supplementsTaken supplementsStackLoaded').lean(),
    Supplement.find({ user: userId, inStack: true }).select('_id').lean(),
  ]);
  const entries = log?.supplementsTaken || [];
  const on = new Set(entries.map((t) => String(t.supplement)));
  const pending = log?.supplementsStackLoaded ? 0 : stack.filter((s) => !on.has(String(s._id))).length;
  return { total: entries.length + pending, taken: entries.filter((t) => t.taken !== false).length };
}

// GET /api/reminders/today?date=YYYY-MM-DD&weekday=0-6&from=ISO&to=ISO
// date and weekday are the user's today; from/to its start and end in their time zone.
exports.today = async (req, res, next) => {
  try {
    const { date, from, to } = req.query;
    const weekday = Number(req.query.weekday);
    const user = await User.findById(req.user.id).select('workoutDays reminders').lean();
    const workoutDay = (user.workoutDays || []).includes(weekday);
    const [workedOut, supplements] = await Promise.all([
      WorkoutSession.exists({ user: req.user.id, date: { $gte: new Date(from), $lte: new Date(to) } }),
      supplementCounts(req.user.id, date),
    ]);
    res.json({
      workoutDays: user.workoutDays || [],
      reminders: user.reminders,
      workoutDay,
      workedOut: Boolean(workedOut),
      supplements,
    });
  } catch (err) {
    next(err);
  }
};
