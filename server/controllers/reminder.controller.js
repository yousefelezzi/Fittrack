/**
 * What the reminders need to know: which of the next 7 days are workout days
 * in the active plan (and whether they've trained today), and how many of
 * today's supplements are ticked off. Used by the web dashboard's reminder
 * cards and by the phone app to plan (and skip) its notifications.
 */
const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');
const Supplement = require('../models/Supplement');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutPlan = require('../models/WorkoutPlan');

const DAY = 86400000;
const AHEAD = 7;

/**
 * Which of the next 7 days (0 = today) the active plan trains on: a weekly
 * plan's weekdays, a rotation's weekdays, or for "every N days" every N days
 * from the last workout (today if it's due or overdue).
 */
async function workoutOffsets(userId, plan, weekday, dayStart, workedOut) {
  if (!plan) return [];
  const offsets = Array.from({ length: AHEAD }, (_, i) => i);
  const weekdayOf = (i) => (weekday + i) % 7;
  if (plan.schedule === 'rotation' && plan.rotation?.everyDays) {
    const n = plan.rotation.everyDays;
    let last = workedOut ? 0 : null; // days from today of the last workout
    if (last === null) {
      const prev = await WorkoutSession.findOne({ user: userId, date: { $lt: dayStart } }).sort({ date: -1 }).select('date').lean();
      if (prev) last = Math.floor((prev.date - dayStart) / DAY);
    }
    const first = last === null ? 0 : Math.max(workedOut ? n : 0, last + n);
    return offsets.filter((i) => i >= first && (i - first) % n === 0);
  }
  const days = plan.schedule === 'rotation' ? (plan.rotation?.weekdays || []) : plan.days.map((d) => d.dayOfWeek);
  return offsets.filter((i) => days.includes(weekdayOf(i)));
}

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
    const [user, plan, worked, supplements] = await Promise.all([
      User.findById(req.user.id).select('reminders').lean(),
      WorkoutPlan.findOne({ user: req.user.id, isActive: true }).select('name schedule rotation days.dayOfWeek').lean(),
      WorkoutSession.exists({ user: req.user.id, date: { $gte: new Date(from), $lte: new Date(to) } }),
      supplementCounts(req.user.id, date),
    ]);
    const workedOut = Boolean(worked);
    const offsets = await workoutOffsets(req.user.id, plan, weekday, new Date(from), workedOut);
    res.json({
      reminders: user.reminders,
      plan: plan ? { name: plan.name } : null,
      workoutOffsets: offsets,           // days from today that are workout days
      workoutDay: offsets.includes(0),   // today, if not trained yet
      workedOut,
      supplements,
    });
  } catch (err) {
    next(err);
  }
};
