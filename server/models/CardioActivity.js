const mongoose = require('mongoose');
const { ACTIVITIES } = require('../utils/cardio');

/**
 * A user's own cardio activity ("Incline treadmill", "Assault bike"). Its
 * calories and step overlap come from the built-in activity it's most like (`base`).
 */
const cardioActivitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    base: { type: String, enum: Object.keys(ACTIVITIES), required: true },
  },
  { timestamps: true }
);

cardioActivitySchema.index({ user: 1, name: 1 });

module.exports = mongoose.model('CardioActivity', cardioActivitySchema);
