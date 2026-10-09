const mongoose = require('mongoose');

/** A user's 1–5 star rating of an exercise (one per user and exercise). */
const exerciseRatingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    stars: { type: Number, min: 1, max: 5, required: true },
  },
  { timestamps: true }
);

exerciseRatingSchema.index({ exercise: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('ExerciseRating', exerciseRatingSchema);
