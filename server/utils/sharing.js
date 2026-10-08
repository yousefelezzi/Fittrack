/**
 * Helpers for things shared in posts and messages (workouts, plans, custom
 * exercises, foods): who may see them, and copying exercises over.
 */
const Exercise = require('../models/Exercise');

/**
 * An exercise the user can use in their own plan: built-ins and their own
 * custom ones as they are; someone else's custom exercise becomes the user's
 * custom exercise with the same name, copied over if they don't have one.
 */
async function usableExercise(e, me) {
  if (!e || !e.isCustom || String(e.createdBy) === me) return e;
  const nameRe = new RegExp(`^${e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const mine = await Exercise.findOne({ isCustom: true, createdBy: me, name: nameRe });
  return mine || Exercise.create({
    name: e.name, muscleGroups: e.muscleGroups, secondaryMuscles: e.secondaryMuscles, equipment: e.equipment,
    category: e.category, laterality: e.laterality, type: e.type, instructions: e.instructions, images: e.images,
    isCustom: true, createdBy: me,
  });
}

/**
 * Whether `me` can see something shared in a post (postId) or a message in one
 * of their chats (messageId). `field` is the attachment's field on the post or
 * message (workoutSession, workoutPlan, exercise, food) and `id` its id. A
 * post counts if its author's privacy settings let `me` see it.
 */
async function canSeeShared(me, { postId, messageId, field, id }) {
  if (postId) {
    const Post = require('../models/Post');
    const { canViewContent, PRIVACY_FIELDS } = require('../utils/privacy');
    const post = await Post.findOne({ _id: postId, [field]: id }).populate('user', PRIVACY_FIELDS).lean();
    if (post && canViewContent(post.user, me)) return true;
  }
  if (messageId) {
    const Message = require('../models/Message');
    const Conversation = require('../models/Conversation');
    const msg = await Message.findOne({ _id: messageId, [field]: id }).select('conversation').lean();
    if (msg && await Conversation.exists({ _id: msg.conversation, participants: me })) return true;
  }
  return false;
}

module.exports = { usableExercise, canSeeShared };
