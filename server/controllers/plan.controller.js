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
      .populate('days.exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality images')
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
    await plan.populate('days.exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality images');
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
    }).select('name muscleGroups secondaryMuscles equipment laterality category images isCustom').lean();
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
    await plan.populate('days.exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality images');
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

    await session.populate('exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality images');
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
