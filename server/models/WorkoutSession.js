const mongoose = require('mongoose');

const setSchema = new mongoose.Schema(
  {
    reps: { type: Number, required: true, min: 0 },
    weight: { type: Number, default: 0, min: 0 }, // kg; 0 = bodyweight
    rir: { type: Number, min: 0, max: 10, default: null }, // reps in reserve; null = not recorded
    // Warm-up sets are logged but don't count toward volume, 1RMs or muscle stats.
    warmup: { type: Boolean, default: false },
    // Unilateral exercises: each set is saved as a left entry then a right entry
    // (rest is on the right one, since it comes after both sides). null = both sides.
    side: { type: String, enum: ['left', 'right', null], default: null },
    restTime: { type: Number, min: 0, default: null }, // seconds rested after this set (timer or typed in)
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const workoutExerciseSchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    sets: [setSchema],
    // The unit the weights were entered in. Weights are always stored in kg;
    // this is only so the exercise is shown (and pre-filled next time) in it.
    weightUnit: { type: String, enum: ['kg', 'lb'], default: 'kg' },
    notes: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const workoutSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, default: 'Workout' },
    date: { type: Date, default: Date.now },
    exercises: [workoutExerciseSchema],
    duration: { type: Number, default: 0 }, // minutes
    notes: { type: String, default: '' },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workoutSessionSchema.index({ user: 1, date: -1 });

// Virtual: total volume (sum of sets × reps × weight)
workoutSessionSchema.virtual('totalVolume').get(function () {
  return this.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((s, set) => (set.warmup ? s : s + set.reps * set.weight), 0);
  }, 0);
});

module.exports = mongoose.model('WorkoutSession', workoutSessionSchema);
