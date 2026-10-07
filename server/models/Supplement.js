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
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

supplementSchema.index({ user: 1, order: 1 });

module.exports = mongoose.model('Supplement', supplementSchema);
