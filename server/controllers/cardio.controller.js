const CardioSession = require('../models/CardioSession');
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

// POST /api/cardio { activity, intensity, minutes, distanceKm?, date?, notes? }
exports.createCardio = async (req, res, next) => {
  try {
    const { activity, intensity, minutes, distanceKm, date, notes } = req.body;
    if (date && new Date(date) > new Date(Date.now() + 60000)) return res.status(400).json({ message: "Cardio can't be in the future" });
    const [user, session] = await Promise.all([
      User.findById(req.user.id).select('weight').lean(),
      CardioSession.create({
        user: req.user.id, activity, intensity, minutes: Math.round(Number(minutes)),
        distanceKm: distanceKm === '' || distanceKm == null ? null : Number(distanceKm),
        ...(date && { date: new Date(date) }), notes: notes || '',
      }),
    ]);
    res.status(201).json(withCalories(session.toObject(), user?.weight));
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
