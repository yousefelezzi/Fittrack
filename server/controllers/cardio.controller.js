const CardioSession = require('../models/CardioSession');
const CardioActivity = require('../models/CardioActivity');
const User = require('../models/User');
const { cardioCalories } = require('../utils/cardio');

const withCalories = (s, kg) => ({ ...s, calories: Math.round(cardioCalories(s, kg).gross) });

// GET /api/cardio?from=&to=  — your cardio, newest first (the last 60 days by default)
exports.getCardio = async (req, res, next) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 60 * 86400000);
    to.setHours(23, 59, 59, 999);
    const [user, sessions] = await Promise.all([
      User.findById(req.user.id).select('weight').lean(),
      CardioSession.find({ user: req.user.id, date: { $gte: from, $lte: to } }).sort({ date: -1 }).limit(200).lean(),
    ]);
    res.json(sessions.map((s) => withCalories(s, user?.weight)));
  } catch (err) {
    next(err);
  }
};

// POST /api/cardio { activity | customActivity, intensity + minutes | segments [{ intensity, seconds }], distanceKm?, date?, notes? }
exports.createCardio = async (req, res, next) => {
  try {
    const { intensity, distanceKm, date, notes } = req.body;
    if (date && new Date(date) > new Date(Date.now() + 60000)) return res.status(400).json({ message: "Cardio can't be in the future" });
    // Your own activity: counts as the built-in one it's like.
    let { activity } = req.body;
    let custom = null;
    if (req.body.customActivity) {
      custom = await CardioActivity.findOne({ _id: req.body.customActivity, user: req.user.id }).lean();
      if (!custom) return res.status(404).json({ message: 'Activity not found' });
      activity = custom.base;
    }
    if (!activity) return res.status(422).json({ message: 'Pick an activity' });
    // A live session: its time per intensity; the session's intensity is the one it spent most time at.
    const segments = Array.isArray(req.body.segments)
      ? req.body.segments.filter((x) => x && Number(x.seconds) > 0).map((x) => ({ intensity: x.intensity, seconds: Math.round(Number(x.seconds)) }))
      : null;
    const seconds = segments?.length ? segments.reduce((n, x) => n + x.seconds, 0) : null;
    const minutes = seconds != null ? Math.max(1, Math.round(seconds / 60)) : Math.round(Number(req.body.minutes));
    if (!(minutes >= 1 && minutes <= 600)) return res.status(422).json({ message: 'Minutes must be between 1 and 600' });
    const main = segments?.length ? [...segments].sort((x, y) => y.seconds - x.seconds)[0].intensity : intensity;
    const [user, session] = await Promise.all([
      User.findById(req.user.id).select('weight').lean(),
      CardioSession.create({
        user: req.user.id, activity, intensity: main || 'moderate', minutes,
        ...(segments?.length && { segments, seconds }),
        ...(custom && { customActivity: custom._id, customName: custom.name }),
        distanceKm: distanceKm === '' || distanceKm == null ? null : Number(distanceKm),
        ...(date && { date: new Date(date) }), notes: notes || '',
      }),
    ]);
    res.status(201).json(withCalories(session.toObject(), user?.weight));
  } catch (err) {
    next(err);
  }
};

// GET /api/cardio/activities  — your own cardio activities
exports.getActivities = async (req, res, next) => {
  try {
    res.json(await CardioActivity.find({ user: req.user.id }).sort({ name: 1 }).lean());
  } catch (err) {
    next(err);
  }
};

// POST /api/cardio/activities { name, base }
exports.createActivity = async (req, res, next) => {
  try {
    const name = String(req.body.name).trim();
    const count = await CardioActivity.countDocuments({ user: req.user.id });
    if (count >= 30) return res.status(400).json({ message: 'You can have up to 30 of your own activities' });
    if (await CardioActivity.exists({ user: req.user.id, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) {
      return res.status(409).json({ message: 'You already have an activity with that name' });
    }
    res.status(201).json(await CardioActivity.create({ user: req.user.id, name, base: req.body.base }));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cardio/activities/:id  — sessions already logged keep their name and calories
exports.deleteActivity = async (req, res, next) => {
  try {
    const { deletedCount } = await CardioActivity.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!deletedCount) return res.status(404).json({ message: 'Activity not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cardio/:id
exports.deleteCardio = async (req, res, next) => {
  try {
    const { deletedCount } = await CardioSession.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!deletedCount) return res.status(404).json({ message: 'Cardio session not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};
