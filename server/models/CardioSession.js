const mongoose = require('mongoose');
const { ACTIVITIES, INTENSITIES } = require('../utils/cardio');

/**
 * A cardio session (run, ride, swim…), logged on its own page. Its calories
 * are estimated from the activity, intensity, minutes and body weight
 * (utils/cardio.js) and count toward the dynamic calorie goal on its day.
 */
const cardioSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    activity: { type: String, enum: Object.keys(ACTIVITIES), required: true },
    intensity: { type: String, enum: INTENSITIES, default: 'moderate' },
    minutes: { type: Number, min: 1, max: 600, required: true },
    // Exact length, and time per intensity, for sessions timed live.
    seconds: { type: Number, min: 0, max: 36000, default: null },
    segments: {
      type: [{ intensity: { type: String, enum: INTENSITIES }, seconds: { type: Number, min: 0 }, _id: false }],
      default: undefined,
    },
    // One of the user's own activities (activity is then its base).
    customActivity: { type: mongoose.Schema.Types.ObjectId, ref: 'CardioActivity', default: null },
    customName: { type: String, trim: true, maxlength: 40, default: '' },
    distanceKm: { type: Number, min: 0, max: 500, default: null },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

cardioSessionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('CardioSession', cardioSessionSchema);
