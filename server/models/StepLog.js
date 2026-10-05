const mongoose = require('mongoose');

// One entry per user per day: the steps walked that day.
const stepLogSchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:  { type: Date, required: true },
    steps: { type: Number, required: true, min: 0, max: 200000 },
  },
  { timestamps: true }
);

stepLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StepLog', stepLogSchema);
