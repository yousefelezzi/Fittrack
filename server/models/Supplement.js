const mongoose = require('mongoose');

/**
 * A supplement the user takes (creatine, vitamin D…). Each day's intake is
 * ticked off on that day's nutrition log (NutritionLog.supplementsTaken).
 */
const supplementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    dose: { type: String, trim: true, maxlength: 40, default: '' },   // e.g. "5 g", "2 capsules"
    timing: { type: String, trim: true, maxlength: 40, default: '' }, // e.g. "Morning", "With dinner"
    // From the built-in list: its micronutrients count toward the day's totals
    // when ticked off, times the servings taken. null = your own (no micros).
    catalog: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplementCatalog', default: null },
    servings: { type: Number, min: 0.25, max: 20, default: 1 },
    // Your own supplement's vitamins and minerals per serving (same keys and
    // units as food micros). Built-in ones use the catalog's instead.
    micros: { type: Map, of: Number, default: {} },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

supplementSchema.index({ user: 1, order: 1 });

module.exports = mongoose.model('Supplement', supplementSchema);
