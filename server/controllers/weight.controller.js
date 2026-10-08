const mongoose = require('mongoose');
const WeightLog = require('../models/WeightLog');
const { syncProfileWeight, dayStart } = require('../utils/bodyWeight');

// GET /api/weight?days=90 — weigh-ins for the last `days` days (plus the one
// before, so the chart's 7-day average can carry it forward) and the current average.
exports.getWeights = async (req, res, next) => {
  try {
    const days = Math.min(730, Math.max(7, Number(req.query.days) || 90));
    const from = new Date(dayStart(new Date()).getTime() - (days - 1) * 86400000);
    const [before, entries, average] = await Promise.all([
      WeightLog.findOne({ user: req.user.id, date: { $lt: from } }).sort({ date: -1 }).select('date weight').lean(),
      WeightLog.find({ user: req.user.id, date: { $gte: from } }).sort({ date: 1 }).select('date weight').lean(),
      syncProfileWeight(req.user.id),
    ]);
    res.json({ entries, before: before || null, average });
  } catch (err) {
    next(err);
  }
};

// POST /api/weight { date: YYYY-MM-DD, weight: kg } — log (or replace) a day's weigh-in
exports.logWeight = async (req, res, next) => {
  try {
    const date = dayStart(req.body.date);
    const entry = await WeightLog.findOneAndUpdate(
      { user: req.user.id, date },
      { $set: { weight: Math.round(Number(req.body.weight) * 100) / 100 }, $setOnInsert: { user: req.user.id, date } },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({ entry, average: await syncProfileWeight(req.user.id) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/weight/:id
exports.deleteWeight = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Weigh-in not found' });
    const { deletedCount } = await WeightLog.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!deletedCount) return res.status(404).json({ message: 'Weigh-in not found' });
    res.json({ deleted: true, average: await syncProfileWeight(req.user.id) });
  } catch (err) {
    next(err);
  }
};
