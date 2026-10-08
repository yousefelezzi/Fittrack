const User = require('../models/User');
const { STAT_KEYS } = require('./stats.controller');
const { canViewContent, canMessage } = require('../utils/privacy');

const MESSAGE_SETTINGS = ['connections', 'following', 'nobody'];

// GET /api/users/search?q=john
exports.searchUsers = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 50);
    if (!q) return res.json([]);
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // search text, not a regex

    const users = await User.find({
      $or: [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: `^${safe}$`, $options: 'i' } }, // exact email only
      ],
      _id: { $ne: req.user.id },
      'privacy.discoverable': { $ne: false }, // "show me in search" turned off
    })
      .select('name avatar bio privacy.privateAccount')
      .limit(20);

    res.json(users);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id
exports.getUserById = async (req, res, next) => {
  try {
    const isOwner = req.params.id === String(req.user.id);
    // Body fat feeds the private FFMI stat, so only the owner gets the raw value.
    const user = await User.findById(req.params.id)
      .select(isOwner ? '-password' : '-password -bodyFat -sex -activityLevel -stepGoal -weightUnit -waterGoal -waterType -bodyWeightUnit -heightUnit -adaptiveCalories -savedFoods')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    const counts = { followersCount: (user.followers || []).length, followingCount: (user.following || []).length };
    if (isOwner) return res.json({ ...user, ...counts, canView: true });

    // Others see whether they can view the profile and message, and whether
    // they've asked to follow; a private profile's lists stay hidden.
    const me = String(req.user.id);
    const canView = canViewContent(user, me);
    const { followRequests, privacy, ...rest } = user;
    res.json({
      ...rest,
      ...counts,
      ...(canView ? {} : { followers: [], following: [] }),
      privacy: { privateAccount: !!privacy?.privateAccount },
      isFollowing: (user.followers || []).some((id) => String(id) === me),
      requested: (followRequests || []).some((id) => String(id) === me),
      canView,
      canMessage: canMessage(user, me),
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/me
exports.updateMe = async (req, res, next) => {
  try {
    const allowed = ['name', 'bio', 'height', 'weight', 'dateOfBirth', 'fitnessGoal', 'bodyFat', 'sex', 'activityLevel', 'stepGoal', 'weightUnit', 'waterGoal', 'waterType', 'bodyWeightUnit', 'heightUnit', 'adaptiveCalories'];
    const updates = {};
    allowed.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    // Visibility toggles are updated one key at a time so a partial object
    // (e.g. { ffmi: true }) doesn't reset the others.
    const vis = req.body.statsVisibility;
    if (vis && typeof vis === 'object') {
      STAT_KEYS.forEach((key) => {
        if (typeof vis[key] === 'boolean') updates[`statsVisibility.${key}`] = vis[key];
      });
    }

    // Privacy settings, one at a time like the stat toggles.
    const privacy = req.body.privacy;
    if (privacy && typeof privacy === 'object') {
      if (typeof privacy.privateAccount === 'boolean') updates['privacy.privateAccount'] = privacy.privateAccount;
      if (typeof privacy.discoverable === 'boolean') updates['privacy.discoverable'] = privacy.discoverable;
      if (MESSAGE_SETTINGS.includes(privacy.messages)) updates['privacy.messages'] = privacy.messages;
      // Going public approves everyone who was waiting.
      if (privacy.privateAccount === false) {
        const pending = (await User.findById(req.user.id).select('followRequests').lean())?.followRequests || [];
        if (pending.length) {
          await User.updateMany({ _id: { $in: pending } }, { $addToSet: { following: req.user.id } });
          await User.updateOne({ _id: req.user.id }, { $addToSet: { followers: { $each: pending } }, $set: { followRequests: [] } });
        }
      }
    }

    // The profile weight is the 7-day average of weigh-ins, so a weight typed
    // in the profile is logged as today's weigh-in (weightDate: the user's
    // today) and the average is worked out from there.
    let loggedWeight = false;
    if (updates.weight !== undefined && updates.weight !== null && updates.weight !== '') {
      const WeightLog = require('../models/WeightLog');
      const { dayStart } = require('../utils/bodyWeight');
      const date = dayStart(req.body.weightDate || new Date());
      await WeightLog.findOneAndUpdate(
        { user: req.user.id, date },
        { $set: { weight: Number(updates.weight) }, $setOnInsert: { user: req.user.id, date } },
        { upsert: true, runValidators: true }
      );
      delete updates.weight;
      loggedWeight = true;
    }

    await User.updateOne({ _id: req.user.id }, updates, { runValidators: true });
    if (loggedWeight) await require('../utils/bodyWeight').syncProfileWeight(req.user.id);
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// POST /api/users/me/avatar
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    );
    res.json({ avatar: user.avatar });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/:id/follow
exports.followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(400).json({ message: 'Cannot follow yourself' });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    const alreadyFollowing = target.followers.includes(req.user.id);
    if (alreadyFollowing) return res.status(400).json({ message: 'Already following' });

    // A private account has to approve new followers.
    if (target.privacy?.privateAccount) {
      await User.findByIdAndUpdate(targetId, { $addToSet: { followRequests: req.user.id } });
      return res.json({ message: 'Follow request sent', requested: true });
    }

    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: req.user.id } });
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { following: targetId } });

    res.json({ message: 'Followed successfully', following: true });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id/follow
exports.unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    // Also cancels a pending follow request.
    await User.findByIdAndUpdate(targetId, { $pull: { followers: req.user.id, followRequests: req.user.id } });
    await User.findByIdAndUpdate(req.user.id, { $pull: { following: targetId } });

    res.json({ message: 'Unfollowed successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/suggestions — people you might want to follow: followed by
// people you follow first (most mutual connections), then recently active posters.
exports.getSuggestions = async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).select('following').lean();
    const skip = new Set([String(req.user.id), ...(me.following || []).map(String)]);

    const friends = await User.find({ _id: { $in: me.following || [] } }).select('following').lean();
    const counts = new Map();
    for (const f of friends) for (const id of f.following || []) {
      const k = String(id);
      if (!skip.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
    }
    let ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);

    if (ids.length < 8) {
      const Post = require('../models/Post');
      const active = await Post.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 200 },
        { $group: { _id: '$user', last: { $max: '$createdAt' } } },
        { $sort: { last: -1 } },
      ]);
      for (const a of active) {
        const k = String(a._id);
        if (!skip.has(k) && !ids.includes(k)) ids.push(k);
        if (ids.length >= 8) break;
      }
    }
    if (ids.length < 8) {
      const newest = await User.find({ _id: { $nin: [...skip, ...ids] } }).sort({ createdAt: -1 }).limit(8 - ids.length).select('_id').lean();
      ids.push(...newest.map((u) => String(u._id)));
    }

    const users = await User.find({ _id: { $in: ids }, 'privacy.discoverable': { $ne: false } }).select('name avatar bio privacy.privateAccount').lean();
    const order = new Map(ids.map((id, i) => [id, i]));
    res.json(users
      .map((u) => ({ ...u, mutual: counts.get(String(u._id)) || 0 }))
      .sort((a, b) => order.get(String(a._id)) - order.get(String(b._id))));
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id/followers
exports.getFollowers = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('privacy followers following').populate('followers', 'name avatar bio');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!canViewContent(user, req.user.id)) return res.status(403).json({ message: 'This account is private.' });
    res.json(user.followers);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id/following
exports.getFollowing = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('privacy followers following').populate('following', 'name avatar bio');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!canViewContent(user, req.user.id)) return res.status(403).json({ message: 'This account is private.' });
    res.json(user.following);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/me/follow-requests — people waiting to follow your private account
exports.getFollowRequests = async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).select('followRequests').populate('followRequests', 'name avatar bio').lean();
    res.json(me?.followRequests || []);
  } catch (err) {
    next(err);
  }
};

// POST /api/users/me/follow-requests/:id — approve: they now follow you
exports.acceptFollowRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const me = await User.findOneAndUpdate(
      { _id: req.user.id, followRequests: id },
      { $pull: { followRequests: id }, $addToSet: { followers: id } },
      { new: true },
    );
    if (!me) return res.status(404).json({ message: 'Request not found' });
    await User.updateOne({ _id: id }, { $addToSet: { following: req.user.id } });
    res.json({ message: 'Request approved' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/me/follow-requests/:id — decline
exports.declineFollowRequest = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $pull: { followRequests: req.params.id } });
    res.json({ message: 'Request declined' });
  } catch (err) {
    next(err);
  }
};
