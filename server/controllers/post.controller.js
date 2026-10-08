const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const WorkoutSession = require('../models/WorkoutSession');
const { canViewContent, PRIVACY_FIELDS } = require('../utils/privacy');

// Whether the viewer may see (and like or comment on) this post: a private
// account's posts are for its followers only. Responds 404 when not.
async function visiblePost(postId, viewerId, res) {
  if (!mongoose.isValidObjectId(postId)) { res.status(404).json({ message: 'Post not found' }); return null; }
  const post = await Post.findById(postId).select('user').lean();
  const author = post && await User.findById(post.user).select(PRIVACY_FIELDS).lean();
  if (!post || !canViewContent(author, viewerId)) { res.status(404).json({ message: 'Post not found' }); return null; }
  return post;
}

// Workout posts show the workout itself, so its exercises are populated too.
const populatePost = (query) =>
  query
    .populate('user', 'name avatar')
    .populate({
      path: 'workoutSession',
      select: 'name exercises duration date',
      populate: { path: 'exercises.exercise', select: 'name images type' },
    })
    .populate({
      path: 'workoutPlan',
      select: 'name description schedule rotation days',
      populate: { path: 'days.exercises.exercise', select: 'name images type laterality' },
    })
    .populate('exercise', 'name muscleGroups secondaryMuscles equipment laterality type category images instructions isCustom createdBy')
    .populate('food', 'name brand per100g servings ingredients numServings category source createdBy')
    .populate('comments.user', 'name avatar');

// GET /api/posts/feed?scope=following|discover&page=1&limit=10
// following: you and the people you follow. discover: everyone's posts, to find people.
exports.getFeed = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const me = await User.findById(req.user.id).select('following');
    let filter;
    if (req.query.scope !== 'discover') {
      filter = { user: { $in: [...me.following, req.user.id] } };
    } else {
      // Everyone's posts, except private accounts you don't follow.
      const hidden = await User.find({ 'privacy.privateAccount': true, _id: { $nin: [...me.following, req.user.id] } }).distinct('_id');
      filter = hidden.length ? { user: { $nin: hidden } } : {};
    }

    const [posts, total] = await Promise.all([
      populatePost(
        Post.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
      ),
      Post.countDocuments(filter),
    ]);

    res.json({ posts, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/posts/user/:userId
exports.getUserPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    if (!mongoose.isValidObjectId(req.params.userId)) return res.json([]);
    const author = await User.findById(req.params.userId).select(PRIVACY_FIELDS).lean();
    if (!canViewContent(author, req.user.id)) return res.json([]); // private account
    const posts = await populatePost(
      Post.find({ user: req.params.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
    );
    res.json(posts);
  } catch (err) {
    next(err);
  }
};

// GET /api/posts/:id
exports.getPostById = async (req, res, next) => {
  try {
    if (!(await visiblePost(req.params.id, req.user.id, res))) return;
    const post = await populatePost(Post.findById(req.params.id));
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (err) {
    next(err);
  }
};

// POST /api/posts
exports.createPost = async (req, res, next) => {
  try {
    const caption = String(req.body.caption || '').trim();
    let workoutSession = null;
    if (req.body.workoutSession) {
      // Only your own workouts can be posted.
      const w = mongoose.isValidObjectId(req.body.workoutSession)
        ? await WorkoutSession.findOne({ _id: req.body.workoutSession, user: req.user.id }).select('_id')
        : null;
      if (!w) return res.status(400).json({ message: 'Workout not found' });
      workoutSession = w._id;
    }
    let workoutPlan = null;
    if (req.body.workoutPlan) {
      // Only your own plans can be posted.
      const WorkoutPlan = require('../models/WorkoutPlan');
      const plan = mongoose.isValidObjectId(req.body.workoutPlan)
        ? await WorkoutPlan.findOne({ _id: req.body.workoutPlan, user: req.user.id }).select('_id')
        : null;
      if (!plan) return res.status(400).json({ message: 'Plan not found' });
      workoutPlan = plan._id;
    }
    // One of your custom exercises, or a custom food / recipe (yours or saved).
    let exercise = null;
    if (req.body.exercise) {
      const Exercise = require('../models/Exercise');
      const ex = mongoose.isValidObjectId(req.body.exercise)
        ? await Exercise.findOne({ _id: req.body.exercise, isCustom: true, createdBy: req.user.id }).select('_id') : null;
      if (!ex) return res.status(400).json({ message: 'Exercise not found' });
      exercise = ex._id;
    }
    let food = null;
    if (req.body.food) {
      const Food = require('../models/Food');
      const f = mongoose.isValidObjectId(req.body.food) ? await Food.findOne({ _id: req.body.food, source: 'custom' }).select('_id') : null;
      if (!f) return res.status(400).json({ message: 'Food not found' });
      food = f._id;
    }
    if (!caption && !workoutSession && !workoutPlan && !exercise && !food && !req.file) {
      return res.status(400).json({ message: 'Add some text, a photo, a workout or a plan' });
    }
    const post = await Post.create({
      user: req.user.id,
      caption,
      workoutSession,
      workoutPlan,
      exercise,
      food,
      image: req.file ? `/uploads/${req.file.filename}` : '',
    });
    res.status(201).json(await populatePost(Post.findById(post._id)));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/posts/:id
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!post) return res.status(404).json({ message: 'Post not found or not yours' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/posts/:id/like
exports.likePost = async (req, res, next) => {
  try {
    if (!(await visiblePost(req.params.id, req.user.id, res))) return;
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { likes: req.user.id } },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ likeCount: post.likes.length });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/posts/:id/like
exports.unlikePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $pull: { likes: req.user.id } },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ likeCount: post.likes.length });
  } catch (err) {
    next(err);
  }
};

// POST /api/posts/:id/comments  { text, parentId? } — a comment, or a reply to one
exports.addComment = async (req, res, next) => {
  try {
    if (!(await visiblePost(req.params.id, req.user.id, res))) return;
    const post = await Post.findById(req.params.id);
    let parent = null;
    if (req.body.parentId) {
      const target = post.comments.id(req.body.parentId);
      if (!target) return res.status(404).json({ message: 'Comment not found' });
      // Replies stay one level deep: replying to a reply answers its thread.
      parent = target.parent || target._id;
    }
    post.comments.push({ user: req.user.id, text: req.body.text, parent });
    await post.save();
    await post.populate('comments.user', 'name avatar');
    res.status(201).json(post.comments);
  } catch (err) {
    next(err);
  }
};

// PUT /api/posts/:id/comments/:commentId  { text } — only its author can edit it
exports.editComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.user.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    comment.text = req.body.text;
    comment.editedAt = new Date();
    await post.save();
    await post.populate('comments.user', 'name avatar');
    res.json(post.comments);
  } catch (err) {
    next(err);
  }
};

// PUT /api/posts/:id  { caption } — only its author can edit it
exports.editPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, user: req.user.id });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const caption = String(req.body.caption ?? '').trim();
    // A post needs something in it: text, a workout or a photo.
    if (!caption && !post.workoutSession && !post.workoutPlan && !post.exercise && !post.food && !post.image) return res.status(400).json({ message: 'A post needs some text' });
    post.caption = caption;
    post.editedAt = new Date();
    await post.save();
    res.json(await populatePost(Post.findById(post._id)));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/posts/:id/comments/:commentId
exports.deleteComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Deleting a comment takes its replies with it.
    post.comments = post.comments.filter((c) => String(c._id) !== req.params.commentId && String(c.parent) !== req.params.commentId);
    await post.save();
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
};
