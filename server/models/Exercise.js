const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    muscleGroups: [
      {
        type: String,
        enum: ['pecs', 'clavicular pecs', 'sternal pecs', 'costal pecs', 'lats', 'trapezius', 'anterior delt', 'middle delt', 'posterior delt', 'elbow flexors', 'biceps', 'brachialis/brachioradialis', 'triceps', 'medial/lateral triceps', 'triceps long head', 'forearms', 'abs', 'erectors', 'adductors', 'hip flexors', 'glutes', 'quads', 'vastus quads', 'rectus femoris', 'hamstrings', 'biarticular hamstrings', 'hamstrings short head', 'calves', 'gastrocnemius', 'soleus'],
      },
    ],
    // Tags (from muscleGroups) that only count half a set each, e.g. the
    // triceps on a bench press. The rest count fully.
    secondaryMuscles: {
      type: [String],
      default: [],
      validate: {
        validator(v) { return (v || []).every((m) => (this.muscleGroups || []).includes(m)); },
        message: 'Secondary muscles must be among the exercise\'s muscle groups',
      },
    },
    equipment: {
      type: String,
      enum: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'resistance_band', 'other'],
      default: 'bodyweight',
    },
    // Strength exercises are logged as sets; cardio ones (jump rope, sleds…) are
    // listed separately and don't need muscle groups.
    category: { type: String, enum: ['strength', 'cardio'], default: 'strength' },
    // How a set is done and logged:
    //   dynamic    — reps × weight, with reps in reserve (most exercises)
    //   yielding   — an isometric hold against a load (plank, wall sit): seconds
    //                held × weight, with seconds in reserve
    //   overcoming — an isometric push/pull against something that doesn't move:
    //                a number of bursts, seconds per burst, rest between bursts
    type: { type: String, enum: ['dynamic', 'yielding', 'overcoming'], default: 'dynamic' },
    // Unilateral exercises (one arm/leg at a time) are logged per side.
    laterality: { type: String, enum: ['bilateral', 'unilateral'], default: 'bilateral' },
    instructions: [{ type: String }], // step-by-step
    gifUrl: { type: String, default: '' },
    // Start and end position photos, e.g. ['/exercise-images/barbell-back-squat-0.jpg', '…-1.jpg'].
    images: { type: [String], default: [] },
    isCustom: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = built-in
  },
  { timestamps: true }
);

exerciseSchema.index({ name: 'text' });
exerciseSchema.index({ muscleGroups: 1 });
exerciseSchema.index({ equipment: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);
