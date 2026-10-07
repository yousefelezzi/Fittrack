const Supplement = require('../models/Supplement');

const FIELDS = ['name', 'dose', 'timing'];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, String(body[k]).trim()]));

// GET /api/supplements — your supplements, in your order
exports.getSupplements = async (req, res, next) => {
  try {
    res.json(await Supplement.find({ user: req.user.id }).sort({ order: 1, createdAt: 1 }).lean());
  } catch (err) {
    next(err);
  }
};

// POST /api/supplements { name, dose?, timing? }
exports.createSupplement = async (req, res, next) => {
  try {
    const count = await Supplement.countDocuments({ user: req.user.id });
    if (count >= 50) return res.status(400).json({ message: 'You can track up to 50 supplements' });
    const supplement = await Supplement.create({ ...pick(req.body), user: req.user.id, order: count });
    res.status(201).json(supplement);
  } catch (err) {
    next(err);
  }
};

// PUT /api/supplements/:id { name?, dose?, timing? }
exports.updateSupplement = async (req, res, next) => {
  try {
    const supplement = await Supplement.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, pick(req.body), { new: true, runValidators: true });
    if (!supplement) return res.status(404).json({ message: 'Supplement not found' });
    res.json(supplement);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/supplements/:id — past days keep their tick (they just stop showing a name)
exports.deleteSupplement = async (req, res, next) => {
  try {
    const { deletedCount } = await Supplement.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!deletedCount) return res.status(404).json({ message: 'Supplement not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};
