/**
 * Body weight from daily weigh-ins. The profile weight (used for calorie
 * targets, FFMI, the water goal…) is the average of the last 7 days, where a
 * day without a weigh-in uses the latest weigh-in before it. Days before the
 * first weigh-in don't count.
 */
const WeightLog = require('../models/WeightLog');
const User = require('../models/User');

const DAY = 86400000;
const dayStart = (d) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * 7-day average ending on `asOf`. `entries` are { date, weight } sorted by date,
 * and must include the latest one before the window (for carrying forward).
 */
function weeklyAverage(entries, asOf) {
  const end = dayStart(asOf).getTime();
  const values = [];
  for (let t = end - 6 * DAY; t <= end; t += DAY) {
    let latest = null;
    for (const e of entries) {
      if (dayStart(e.date).getTime() <= t) latest = e; else break;
    }
    if (latest) values.push(latest.weight);
  }
  return values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** The weigh-ins the 7-day average ending on `asOf` needs. */
async function entriesForAverage(userId, asOf) {
  const start = new Date(dayStart(asOf).getTime() - 6 * DAY);
  const [before, inWindow] = await Promise.all([
    WeightLog.findOne({ user: userId, date: { $lt: start } }).sort({ date: -1 }).lean(),
    WeightLog.find({ user: userId, date: { $gte: start, $lte: dayStart(asOf) } }).sort({ date: 1 }).lean(),
  ]);
  return before ? [before, ...inWindow] : inWindow;
}

/**
 * Set the user's profile weight to their 7-day average (as of today, or their
 * latest weigh-in if that's later, e.g. a timezone ahead). Returns the average,
 * or null if they've never weighed in (the profile weight is left alone).
 */
async function syncProfileWeight(userId) {
  const latest = await WeightLog.findOne({ user: userId }).sort({ date: -1 }).select('date').lean();
  if (!latest) return null;
  const asOf = new Date(Math.max(dayStart(new Date()).getTime(), dayStart(latest.date).getTime()));
  const average = weeklyAverage(await entriesForAverage(userId, asOf), asOf);
  if (average != null) await User.updateOne({ _id: userId }, { $set: { weight: average } });
  return average;
}

module.exports = { weeklyAverage, syncProfileWeight, dayStart };
