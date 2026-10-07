const WorkoutPlan = require('../models/WorkoutPlan');
const { generatePlan, analyzePlan, planSkeleton } = require('../utils/planGenerator');
const User = require('../models/User');
const { userSecondaryWeight, LEVEL_FIELDS } = require('../utils/trainingLevel');

const LEVEL_KEYS = ['beginner', 'intermediate', 'advanced'];
const Exercise = require('../models/Exercise');
const WorkoutSession = require('../models/WorkoutSession');

// GET /api/plans
exports.getPlans = async (req, res, next) => {
  try {
    const plans = await WorkoutPlan.find({ user: req.user.id })
      .populate('days.exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images')
      .sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    next(err);
  }
};

// GET /api/plans/:id
exports.getPlanById = async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id }).populate(
      'days.exercises.exercise'
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// POST /api/plans
exports.createPlan = async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.create({ ...req.body, user: req.user.id });
    await plan.populate('days.exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images');
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
};

// POST /api/plans/generate  { daysPerWeek, maxSets, maxExercises, equipment[], priorities[], … }
// Builds a low-volume, high-frequency full-body plan (see utils/planGenerator.js).
// Nothing is saved — the client shows it and saves it with POST /api/plans.
exports.generatePlan = async (req, res, next) => {
  try {
    const exercises = await Exercise.find({
      $or: [{ isCustom: false }, { isCustom: true, createdBy: req.user.id }],
    }).select('name muscleGroups secondaryMuscles equipment laterality type category images isCustom').lean();
    // The secondary-muscle weight follows the level picked (the plan may be for
    // someone else), so a value sent in the request is ignored.
    req.body = { ...req.body };
    delete req.body.secondaryWeight;
    const result = generatePlan(exercises, req.body);
    if (result.plan.days.every((d) => d.exercises.length === 0)) {
      return res.status(400).json({ message: 'No exercises match that equipment.' });
    }

    // If some muscles would still lose ground (negative WNS) — usually because
    // sessions are too short or too few to reach everything — try the closest
    // changes and suggest the ones that fix it.
    const losing = (r) => r.analysis.units.filter((u) => u.required && u.wns < 0).length;
    const n = losing(result);
    if (n > 0) {
      const opts = req.body;
      const days = Number(opts.daysPerWeek) || 4;
      const sets = Number(opts.maxSets) || 20;
      const maxExercises = Number(opts.maxExercises) || 8;
      const tries = [
        opts.variation !== 'repeat' && { label: 'Same workout each time', change: { variation: 'repeat' } },
        sets < 40 && { label: `${Math.min(40, sets + 4)} sets per session`, change: { maxSets: Math.min(40, sets + 4) } },
        maxExercises < 12 && { label: `${maxExercises + 1} exercises per session`, change: { maxExercises: maxExercises + 1 } },
        days < 6 && { label: `${days + 1} days a week`, change: { daysPerWeek: days + 1, split: undefined } },
        opts.priorities?.length && { label: 'No priorities', change: { priorities: [] } },
      ].filter(Boolean);
      result.analysis.suggestions = tries
        .map((t) => ({ ...t, losing: losing(generatePlan(exercises, { ...opts, ...t.change })) }))
        .filter((t) => t.losing < n)
        .sort((a, b) => a.losing - b.losing);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// POST /api/plans/analyze  { days: [{ dayOfWeek, exercises: [{ exercise: id, targetSets }] }], priorities[] }
// WNS and recovery for a plan, e.g. after swapping exercises in a generated one.
// POST /api/plans/skeleton  { daysPerWeek, split, variation }
// The sessions and schedule a split gives (same as the generator), for building a plan by hand.
exports.planSkeleton = (req, res) => {
  const s = planSkeleton(req.body);
  res.json({
    daysPerWeek: s.daysPerWeek,
    split: s.splitKey,
    name: s.split.name,
    variation: s.variation,
    schedule: s.schedule,
    rotation: s.rotation,
    templates: s.templates.map((t) => ({ type: t.type, label: t.label })),
    slots: s.slots,
  });
};

exports.analyzePlan = async (req, res, next) => {
  try {
    const days = Array.isArray(req.body.days) ? req.body.days : [];
    const ids = [...new Set(days.flatMap((d) => (d.exercises || []).map((e) => String(e.exercise?._id || e.exercise))))]
      .filter((id) => require('mongoose').isValidObjectId(id));
    const docs = await Exercise.find({
      _id: { $in: ids },
      $or: [{ isCustom: false }, { isCustom: true, createdBy: req.user.id }],
    }).select('muscleGroups secondaryMuscles').lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const withMuscles = days.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      exercises: (d.exercises || []).map((e) => ({
        exercise: byId.get(String(e.exercise?._id || e.exercise)), targetSets: e.targetSets, targetReps: e.targetReps, targetRir: e.targetRir,
      })),
    }));
    // A picked level (generator, plan builder) sets how much secondary muscles
    // count; without one, it's the user's own level from their FFMI.
    const opts = { ...req.body };
    delete opts.secondaryWeight;
    if (!LEVEL_KEYS.includes(opts.level)) {
      opts.secondaryWeight = userSecondaryWeight(await User.findById(req.user.id).select(LEVEL_FIELDS).lean());
    }
    res.json(analyzePlan(withMuscles, opts));
  } catch (err) {
    next(err);
  }
};

// PUT /api/plans/:id
exports.updatePlan = async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    await plan.populate('days.exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images');
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/plans/:id
exports.deletePlan = async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/plans/:id/start  — clone today's plan day into a live WorkoutSession
exports.startPlan = async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id }).populate(
      'days.exercises.exercise'
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    let planDay;
    let dayOfWeek = req.body.dayOfWeek ?? new Date().getDay();
    if (plan.schedule === 'rotation') {
      // Next workout in the rotation: the one after the last session started from this plan.
      const ordered = [...plan.days].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      const last = await WorkoutSession.findOne({ user: req.user.id, name: { $regex: `^${plan.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — ` } })
        .sort({ date: -1 }).select('name').lean();
      const lastIdx = last ? ordered.findIndex((d) => last.name.endsWith(`— ${d.label}`)) : -1;
      planDay = ordered[(lastIdx + 1) % ordered.length];
      dayOfWeek = planDay?.dayOfWeek ?? 0;
    } else {
      planDay = plan.days.find((d) => d.dayOfWeek === dayOfWeek);
    }
    if (!planDay) return res.status(400).json({ message: 'No day configured for today in this plan' });

    const exercises = planDay.exercises.map((e) => ({
      exercise: e.exercise._id,
      // Unilateral exercises get a left and a right entry for each set.
      sets: Array.from({ length: e.targetSets }, () => (
        e.exercise.laterality === 'unilateral'
          ? ['left', 'right'].map((side) => ({ reps: e.targetReps, weight: e.targetWeight, side }))
          : [{ reps: e.targetReps, weight: e.targetWeight }]
      )).flat(),
      order: e.order,
    }));

    const session = await WorkoutSession.create({
      user: req.user.id,
      name: `${plan.name} — ${planDay.label || 'Day ' + (dayOfWeek + 1)}`,
      date: new Date(),
      exercises,
    });

    await session.populate('exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images');
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/plans/:id/activate
exports.setActivePlan = async (req, res, next) => {
  try {
    // Deactivate all other plans for this user
    await WorkoutPlan.updateMany({ user: req.user.id }, { isActive: false });
    const plan = await WorkoutPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isActive: true },
      { new: true }
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// POST /api/plans/from-workout { workoutId, postId?, messageId? }
// Save a workout as a template (a one-workout plan). It can be your own, or one
// shared with you: in a post you can see (postId) or a message in one of your
// chats (messageId). Someone else's custom exercises are copied into yours.
exports.saveWorkoutAsPlan = async (req, res, next) => {
  try {
    const me = String(req.user.id);
    const { workoutId, postId, messageId } = req.body;
    const notFound = () => res.status(404).json({ message: 'Workout not found' });

    const workout = await WorkoutSession.findById(workoutId)
      .populate('exercises.exercise')
      .populate('user', 'name privacy followers following')
      .lean();
    if (!workout) return notFound();

    // You can save it if it's yours, or it reached you through a post or a message.
    let allowed = String(workout.user?._id) === me;
    if (!allowed && postId) {
      const Post = require('../models/Post');
      const { canViewContent } = require('../utils/privacy');
      const post = await Post.findOne({ _id: postId, workoutSession: workoutId }).select('_id').lean();
      allowed = !!post && canViewContent(workout.user, me);
    }
    if (!allowed && messageId) {
      const Message = require('../models/Message');
      const Conversation = require('../models/Conversation');
      const msg = await Message.findOne({ _id: messageId, workoutSession: workoutId }).select('conversation').lean();
      allowed = !!msg && !!(await Conversation.exists({ _id: msg.conversation, participants: me }));
    }
    if (!allowed) return notFound();

    // Custom exercises you can't use (someone else's) get a copy of your own,
    // or your existing custom exercise with the same name.
    for (const ex of workout.exercises) {
      const e = ex.exercise;
      if (!e || !e.isCustom || String(e.createdBy) === me) continue;
      const nameRe = new RegExp(`^${e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const mine = await Exercise.findOne({ isCustom: true, createdBy: me, name: nameRe });
      ex.exercise = mine || await Exercise.create({
        name: e.name, muscleGroups: e.muscleGroups, secondaryMuscles: e.secondaryMuscles, equipment: e.equipment,
        category: e.category, laterality: e.laterality, type: e.type, instructions: e.instructions, images: e.images,
        isCustom: true, createdBy: me,
      });
    }

    const { planExercisesFromWorkout } = require('../utils/planFromWorkout');
    const exercises = planExercisesFromWorkout(workout);
    if (!exercises.length) return res.status(400).json({ message: 'That workout has no exercises to save' });

    const from = String(workout.user?._id) === me ? '' : ` (from ${workout.user?.name || 'someone'})`;
    const plan = await WorkoutPlan.create({
      user: me,
      name: `${workout.name}${from}`.slice(0, 100),
      description: from ? `Saved from ${workout.user?.name}'s workout.` : 'Saved from one of your workouts.',
      schedule: 'rotation',
      days: [{ dayOfWeek: 0, label: workout.name, exercises }],
    });
    await plan.populate('days.exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images');
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
};
