const mongoose = require('mongoose');

/**
 * The built-in list of common supplements (and sun exposure) with the
 * micronutrients in one serving. Synced from utils/supplementCatalog.js.
 */
const supplementCatalogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    serving: { type: String, default: '' },  // e.g. "1 softgel (1,000 IU)"
    category: { type: String, default: '' }, // vitamins, minerals, fats & fiber, performance, health & sleep, sun
    micros: { type: Map, of: Number, default: {} }, // same keys/units as food micros
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupplementCatalog', supplementCatalogSchema);
