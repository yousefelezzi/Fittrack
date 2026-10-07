const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    // A reply points at the comment it answers (replies are one level deep).
    parent: { type: mongoose.Schema.Types.ObjectId, default: null },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workoutSession: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutSession', default: null },
    // A whole plan (all its days) can be shared too.
    workoutPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutPlan', default: null },
    caption: { type: String, trim: true, maxlength: 500, default: '' },
    image: { type: String, default: '' }, // Local upload URL
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

postSchema.index({ user: 1, createdAt: -1 });

// Virtual: like count
postSchema.virtual('likeCount').get(function () {
  return this.likes.length;
});

// Virtual: comment count
postSchema.virtual('commentCount').get(function () {
  return this.comments.length;
});

postSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
