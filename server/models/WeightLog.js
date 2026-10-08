const mongoose = require('mongoose');

/** A day's body-weight weigh-in (kg). One per day; the profile weight is the 7-day average. */
const weightLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true }, // the day, at 00:00 UTC
    weight: { type: Number, required: true, min: 20, max: 400 }, // kg
  },
  { timestamps: true }
);

weightLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WeightLog', weightLogSchema);
