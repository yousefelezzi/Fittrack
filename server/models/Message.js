const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    // Optional: share a workout in the chat.
    workoutSession: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutSession', default: null },
    // Or a whole workout plan.
    workoutPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutPlan', default: null },
    // Or a custom exercise, or a custom food / recipe.
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', default: null },
    food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
    readAt: { type: Date, default: null }, // one-to-one: when the other person read it
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // groups: who has read it
    // "Sam created the group", "Alex left" — shown as a note, not a bubble.
    system: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
