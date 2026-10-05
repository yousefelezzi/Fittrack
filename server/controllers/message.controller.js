const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const WorkoutSession = require('../models/WorkoutSession');
const { canMessage, PRIVACY_FIELDS } = require('../utils/privacy');

const NOT_ACCEPTING = 'This person isn\'t accepting messages from you.';

const isId = (id) => mongoose.isValidObjectId(id);
const same = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);
const workoutPopulate = {
  path: 'workoutSession',
  select: 'name duration date exercises',
  populate: { path: 'exercises.exercise', select: 'name images' },
};

// A conversation the current user is part of, or null.
const myConversation = (id, userId) =>
  isId(id) ? Conversation.findOne({ _id: id, participants: userId }) : null;

// Messages someone hasn't read: from others, not marked read for them. One-to-one
// chats use readAt (the only reader is the other person); groups use readBy.
const unreadFilter = (me) => ({
  sender: { $ne: new mongoose.Types.ObjectId(String(me)) },
  readAt: null,
  readBy: { $ne: new mongoose.Types.ObjectId(String(me)) },
});

/**
 * How a conversation is sent to the client. Participants must be populated.
 *   other   — the other person (one-to-one), or null
 *   members — everyone else in the chat
 */
function summary(convo, me, extra = {}) {
  const members = convo.participants.filter((p) => !same(p, me));
  return {
    _id: convo._id,
    isGroup: !!convo.isGroup,
    name: convo.name || '',
    createdBy: convo.createdBy || null,
    other: convo.isGroup ? null : members[0] || null,
    members,
    lastMessage: convo.lastMessage,
    updatedAt: convo.updatedAt,
    ...extra,
  };
}

// Adds a note like "Sam left the group" and makes it the chat's latest message.
async function postSystemMessage(convo, sender, text) {
  const message = await Message.create({ conversation: convo._id, sender, text, system: true, readBy: [sender] });
  convo.lastMessage = { text, sender, sentAt: message.createdAt };
  await convo.save();
  return message;
}

const nameOf = async (id) => (await User.findById(id).select('name').lean())?.name || 'Someone';

/**
 * Checks a list of user ids to add to a group: real users who accept messages
 * from you (by their own settings). Returns { ids } or { error, status }.
 */
async function checkNewMembers(userIds, me, existing = []) {
  const wanted = [...new Set((userIds || []).map(String))]
    .filter((id) => !same(id, me) && !existing.some((e) => same(e, id)));
  if (wanted.some((id) => !isId(id))) return { status: 400, error: 'Invalid user' };
  const users = await User.find({ _id: { $in: wanted } }).select(`name ${PRIVACY_FIELDS}`).lean();
  if (users.length !== wanted.length) return { status: 404, error: 'User not found' };
  const blocked = users.filter((u) => !canMessage(u, me));
  if (blocked.length) {
    return { status: 403, error: `${blocked.map((u) => u.name).join(', ')} ${blocked.length > 1 ? 'aren\'t' : 'isn\'t'} accepting messages from you.` };
  }
  return { ids: wanted, users };
}

// GET /api/messages/conversations — inbox, newest first, with unread counts
exports.getConversations = async (req, res, next) => {
  try {
    const me = req.user.id;
    const conversations = await Conversation.find({ participants: me, 'lastMessage.sentAt': { $ne: null } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate('participants', 'name avatar')
      .populate('lastMessage.sender', 'name')
      .lean();
    const unread = await Message.aggregate([
      { $match: { conversation: { $in: conversations.map((c) => c._id) }, ...unreadFilter(me) } },
      { $group: { _id: '$conversation', n: { $sum: 1 } } },
    ]);
    const unreadBy = new Map(unread.map((u) => [String(u._id), u.n]));
    res.json(conversations.map((c) => {
      // lastMessage.sender goes out as an id, plus the name for groups ("Sam: hi").
      const sender = c.lastMessage?.sender;
      const lastMessage = { ...c.lastMessage, sender: sender?._id ?? null, senderName: sender?.name ?? null };
      return summary({ ...c, lastMessage }, me, { unread: unreadBy.get(String(c._id)) || 0 });
    }));
  } catch (err) {
    next(err);
  }
};

// GET /api/messages/unread — total unread messages (for the nav badge)
exports.getUnreadCount = async (req, res, next) => {
  try {
    const me = req.user.id;
    const ids = await Conversation.find({ participants: me }).distinct('_id');
    const count = await Message.countDocuments({ conversation: { $in: ids }, ...unreadFilter(me) });
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/conversations { userId } — open (or create) a chat with someone.
// Who can start a chat is up to the other person's "who can message me"
// setting (by default: one of you follows the other). An existing chat can
// always be opened to read it.
exports.openConversation = async (req, res, next) => {
  try {
    const me = req.user.id;
    const { userId } = req.body;
    if (!isId(userId) || String(userId) === String(me)) return res.status(400).json({ message: 'Invalid user' });

    let convo = await Conversation.findOne({ isGroup: { $ne: true }, participants: { $all: [me, userId], $size: 2 } });
    if (!convo) {
      const theirs = await User.findById(userId).select(PRIVACY_FIELDS).lean();
      if (!theirs) return res.status(404).json({ message: 'User not found' });
      if (!canMessage(theirs, me)) return res.status(403).json({ message: NOT_ACCEPTING });
      convo = await Conversation.create({ participants: [me, userId] });
    }
    await convo.populate('participants', 'name avatar');
    res.json(summary(convo, me));
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/groups { name, userIds } — start a group chat. Everyone
// added must accept messages from you (their "who can message me" setting).
exports.createGroup = async (req, res, next) => {
  try {
    const me = req.user.id;
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Give the group a name' });
    const check = await checkNewMembers(req.body.userIds, me);
    if (check.error) return res.status(check.status).json({ message: check.error });
    if (check.ids.length < 2) return res.status(400).json({ message: 'Add at least two people' });
    if (check.ids.length + 1 > Conversation.MAX_GROUP_SIZE) {
      return res.status(400).json({ message: `A group can have up to ${Conversation.MAX_GROUP_SIZE} people` });
    }

    const convo = await Conversation.create({ participants: [me, ...check.ids], isGroup: true, name, createdBy: me });
    await postSystemMessage(convo, me, `${await nameOf(me)} created "${name}"`);
    await convo.populate('participants', 'name avatar');
    res.status(201).json(summary(convo, me));
  } catch (err) {
    next(err);
  }
};

// PUT /api/messages/conversations/:id { name } — rename a group (any member)
exports.renameGroup = async (req, res, next) => {
  try {
    const me = req.user.id;
    const convo = await myConversation(req.params.id, me);
    if (!convo?.isGroup) return res.status(404).json({ message: 'Group not found' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Give the group a name' });
    if (name !== convo.name) {
      convo.name = name;
      await postSystemMessage(convo, me, `${await nameOf(me)} renamed the group to "${name}"`);
    }
    await convo.populate('participants', 'name avatar');
    res.json(summary(convo, me));
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/conversations/:id/members { userIds } — add people to a group (any member)
exports.addMembers = async (req, res, next) => {
  try {
    const me = req.user.id;
    const convo = await myConversation(req.params.id, me);
    if (!convo?.isGroup) return res.status(404).json({ message: 'Group not found' });
    const check = await checkNewMembers(req.body.userIds, me, convo.participants);
    if (check.error) return res.status(check.status).json({ message: check.error });
    if (!check.ids.length) return res.status(400).json({ message: 'They\'re already in the group' });
    if (convo.participants.length + check.ids.length > Conversation.MAX_GROUP_SIZE) {
      return res.status(400).json({ message: `A group can have up to ${Conversation.MAX_GROUP_SIZE} people` });
    }
    convo.participants.push(...check.ids);
    await postSystemMessage(convo, me, `${await nameOf(me)} added ${check.users.map((u) => u.name).join(', ')}`);
    await convo.populate('participants', 'name avatar');
    res.json(summary(convo, me));
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/conversations/:id/leave — leave a group. The last one out deletes it.
exports.leaveGroup = async (req, res, next) => {
  try {
    const me = req.user.id;
    const convo = await myConversation(req.params.id, me);
    if (!convo?.isGroup) return res.status(404).json({ message: 'Group not found' });
    convo.participants = convo.participants.filter((p) => !same(p, me));
    if (convo.participants.length === 0) {
      await Message.deleteMany({ conversation: convo._id });
      await convo.deleteOne();
    } else {
      await postSystemMessage(convo, me, `${await nameOf(me)} left the group`);
    }
    res.json({ left: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/messages/conversations/:id?before=<ISO date>&limit=30 — messages, oldest first.
// `people` has the name and avatar of everyone who sent one (including people
// who have since left a group); `unread` is how many are unread for you.
exports.getMessages = async (req, res, next) => {
  try {
    const me = req.user.id;
    const convo = await myConversation(req.params.id, me);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const filter = { conversation: convo._id };
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
    const page = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate(workoutPopulate).lean();
    const messages = page.slice(0, limit).reverse();

    const senderIds = [...new Set(messages.map((m) => String(m.sender)))];
    const senders = await User.find({ _id: { $in: senderIds } }).select('name avatar').lean();
    const people = Object.fromEntries(senders.map((u) => [String(u._id), u]));
    const unread = await Message.countDocuments({ conversation: convo._id, ...unreadFilter(me) });
    res.json({ messages, hasMore: page.length > limit, people, unread });
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/conversations/:id { text, workoutSession? }
exports.sendMessage = async (req, res, next) => {
  try {
    const me = req.user.id;
    const convo = await myConversation(req.params.id, me);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });
    if (!convo.isGroup) {
      // Sending follows the other person's current setting (they may have turned messages off since).
      // Group members agreed when they were added, and can leave.
      const otherId = convo.participants.find((p) => String(p) !== String(me));
      const other = await User.findById(otherId).select(PRIVACY_FIELDS).lean();
      if (!canMessage(other, me)) return res.status(403).json({ message: NOT_ACCEPTING });
    }
    const text = String(req.body.text || '').trim();
    let workoutSession = null;
    if (req.body.workoutSession) {
      // Only your own workouts can be shared.
      const w = isId(req.body.workoutSession)
        ? await WorkoutSession.findOne({ _id: req.body.workoutSession, user: me }).select('_id name')
        : null;
      if (!w) return res.status(400).json({ message: 'Workout not found' });
      workoutSession = w._id;
    }
    if (!text && !workoutSession) return res.status(400).json({ message: 'Message is empty' });

    const message = await Message.create({ conversation: convo._id, sender: me, text, workoutSession, readBy: [me] });
    convo.lastMessage = { text: text || 'Shared a workout', sender: me, sentAt: message.createdAt };
    await convo.save();
    await message.populate(workoutPopulate);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/conversations/:id/read — mark everyone else's messages read for you
exports.markRead = async (req, res, next) => {
  try {
    const me = req.user.id;
    const convo = await myConversation(req.params.id, me);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });
    const update = convo.isGroup
      ? { $addToSet: { readBy: me } }
      : { $set: { readAt: new Date() }, $addToSet: { readBy: me } };
    const { modifiedCount } = await Message.updateMany({ conversation: convo._id, ...unreadFilter(me) }, update);
    res.json({ marked: modifiedCount });
  } catch (err) {
    next(err);
  }
};
