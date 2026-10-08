const Supplement = require('../models/Supplement');
const SupplementCatalog = require('../models/SupplementCatalog');

const FIELDS = ['name', 'dose', 'timing'];
const { MICRO_KEYS } = require('../utils/nutritionConstants');

// Your own micros: known keys with an amount above 0 (others are dropped).
const cleanMicros = (micros) => Object.fromEntries(Object.entries(micros || {})
  .filter(([k, v]) => MICRO_KEYS.includes(k) && Number(v) > 0 && Number(v) < 100000)
  .map(([k, v]) => [k, Math.round(Number(v) * 1000) / 1000]));

const pick = (body) => ({
  ...Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, String(body[k]).trim()])),
  ...(body.servings !== undefined && { servings: Number(body.servings) }),
  ...(body.micros !== undefined && { micros: cleanMicros(body.micros) }),
  ...(body.inStack !== undefined && { inStack: Boolean(body.inStack) }),
});
const MAX_SUPPLEMENTS = 100;

// GET /api/supplements/catalog — the built-in list, by category
exports.getCatalog = async (req, res, next) => {
  try {
    res.json(await SupplementCatalog.find().sort({ category: 1, name: 1 }).lean());
  } catch (err) {
    next(err);
  }
};

// GET /api/supplements — every supplement you've used (inStack marks your stack), in your order
exports.getSupplements = async (req, res, next) => {
  try {
    res.json(await Supplement.find({ user: req.user.id }).sort({ order: 1, createdAt: 1 }).populate('catalog').lean());
  } catch (err) {
    next(err);
  }
};

// POST /api/supplements { name | catalogId, dose?, timing?, servings?, micros?, inStack? }
// inStack: false adds it for a day without putting it in your stack.
exports.createSupplement = async (req, res, next) => {
  try {
    // From the built-in list: its name and serving fill in anything left blank.
    let catalog = null;
    if (req.body.catalogId) {
      catalog = await SupplementCatalog.findById(req.body.catalogId).lean();
      if (!catalog) return res.status(404).json({ message: 'Supplement not found in the list' });
      // Already used it: reuse that one (adding it to the stack if asked).
      const existing = await Supplement.findOne({ user: req.user.id, catalog: catalog._id });
      if (existing) {
        if (req.body.inStack && !existing.inStack) { existing.inStack = true; await existing.save(); }
        await existing.populate('catalog');
        return res.json(existing);
      }
    }
    const count = await Supplement.countDocuments({ user: req.user.id });
    if (count >= MAX_SUPPLEMENTS) return res.status(400).json({ message: `You can track up to ${MAX_SUPPLEMENTS} supplements` });
    const fields = pick(req.body);
    const supplement = await Supplement.create({
      ...fields,
      name: fields.name || catalog?.name,
      dose: fields.dose ?? catalog?.serving ?? '',
      catalog: catalog?._id ?? null,
      user: req.user.id,
      order: count,
    });
    await supplement.populate('catalog');
    res.status(201).json(supplement);
  } catch (err) {
    next(err);
  }
};

// PUT /api/supplements/:id { name?, dose?, timing?, servings?, micros?, inStack? }
// Days already logged keep the servings they were logged with.
exports.updateSupplement = async (req, res, next) => {
  try {
    const supplement = await Supplement.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, pick(req.body), { new: true, runValidators: true }).populate('catalog');
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
