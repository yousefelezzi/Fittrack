const mongoose = require('mongoose');

const planDaySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday
    label: { type: String, default: '' }, // e.g. "Full Body"
    exercises: [
      {
        exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
        targetSets: { type: Number, default: 3 },
        targetReps: { type: Number, default: 10 },
        targetWeight: { type: Number, default: 0 }, // in weightUnit
        weightUnit: { type: String, enum: ['kg', 'lb'], default: 'kg' },
        targetRepsMax: { type: Number, default: null }, // top of a rep range (targetReps is the bottom)
        targetRir: { type: String, default: '' }, // e.g. "0–2"; reps to leave in reserve
        order: { type: Number, default: 0 },
      },
    ],
  },
  { _id: false }
);

const workoutPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    days: [planDaySchema],
    // 'weekly': each day has its weekday. 'rotation': the days are workouts done
    // in order, cycling — on the given weekdays, or every N days (e.g. every other day).
    // For rotations, a day's dayOfWeek is its position in the order.
    schedule: { type: String, enum: ['weekly', 'rotation'], default: 'weekly' },
    rotation: {
      weekdays: { type: [Number], default: undefined }, // 0 = Sunday
      everyDays: { type: Number, min: 1, max: 7, default: undefined },
    },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workoutPlanSchema.index({ user: 1 });

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);
