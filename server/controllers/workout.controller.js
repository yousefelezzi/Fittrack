const WorkoutSession = require('../models/WorkoutSession');
const { estimateOneRepMax, asRepSet } = require('../utils/oneRepMax');
const Exercise = require('../models/Exercise');
const { muscleBreakdown, muscleSessions } = require('../utils/muscleGroups');
const User = require('../models/User');
const { userSecondaryWeight, LEVEL_FIELDS } = require('../utils/trainingLevel');

// How much a secondary muscle counts in this user's volume (0.5 − x, from their FFMI).
const mySecondaryWeight = async (userId) => userSecondaryWeight(await User.findById(userId).select(LEVEL_FIELDS).lean());

// GET /api/workouts
exports.getWorkouts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, from, to } = req.query;
    const filter = { user: req.user.id };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const [workouts, total] = await Promise.all([
      WorkoutSession.find(filter)
        .populate('exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images')
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      WorkoutSession.countDocuments(filter),
    ]);

    res.json({ workouts, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/workouts/muscle-sessions?days=56
// Sets per muscle (and sub-region) in each workout, for the weekly volume check.
exports.getMuscleSessions = async (req, res, next) => {
  try {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 56));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [sessions, secondaryWeight] = await Promise.all([
      WorkoutSession.find({ user: req.user.id, date: { $gte: since } })
        .select('date exercises')
        .sort({ date: 1 })
        .populate('exercises.exercise', 'muscleGroups secondaryMuscles')
        .lean(),
      mySecondaryWeight(req.user.id),
    ]);
    res.json(muscleSessions(sessions, secondaryWeight));
  } catch (err) {
    next(err);
  }
};

// GET /api/workouts/stats
exports.getWorkoutStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Workouts per week for last 12 weeks
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const secondaryWeight = await mySecondaryWeight(userId);
    const [totalWorkouts, recentWorkouts, allSessions] = await Promise.all([
      WorkoutSession.countDocuments({ user: userId }),

      WorkoutSession.find({ user: userId, date: { $gte: twelveWeeksAgo } })
        .select('date exercises duration')
        .populate('exercises.exercise', 'muscleGroups secondaryMuscles'),

      WorkoutSession.find({ user: userId })
        .select('exercises')
        .populate('exercises.exercise', 'muscleGroups secondaryMuscles')
        .lean(),
    ]);

    // Sets per muscle, all time (see utils/muscleGroups.js for sub-regions):
    // total counts secondary muscles at the user's 0.5 − x; direct only counts
    // sets where the muscle is a main target (secondary counts 0).
    const muscleGroupStats = muscleBreakdown(allSessions, secondaryWeight);
    const muscleGroupStatsDirect = muscleBreakdown(allSessions, 0);

    res.json({ totalWorkouts, recentWorkouts, muscleGroupStats, muscleGroupStatsDirect });
  } catch (err) {
    next(err);
  }
};

// GET /api/workouts/progress/:exerciseId
// GET /api/workouts/last/:exerciseId — the sets from the most recent workout
// with this exercise (for pre-filling it when it's logged again), or
// { date: null, sets: [] } if it's never been logged. If the exercise appears
// twice in that workout (e.g. split with "do it later"), its sets are combined.
exports.getLastSets = async (req, res, next) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.exerciseId)) return res.json({ date: null, sets: [] });
    const session = await WorkoutSession.findOne({ user: req.user.id, 'exercises.exercise': req.params.exerciseId })
      .select('date exercises')
      .sort({ date: -1 })
      .lean();
    if (!session) return res.json({ date: null, sets: [] });
    const entries = session.exercises.filter((e) => String(e.exercise) === req.params.exerciseId);
    const sets = entries.flatMap((e) => e.sets.map((s) => ({
      reps: s.reps, weight: s.weight, rir: s.rir ?? null, side: s.side ?? null, warmup: !!s.warmup,
      duration: s.duration ?? null, sir: s.sir ?? null, bursts: s.bursts ?? null, burstSeconds: s.burstSeconds ?? null, burstRest: s.burstRest ?? null,
    })));
    // Weights are in kg; weightUnit is what they were entered in.
    res.json({ date: session.date, sets, weightUnit: entries[0]?.weightUnit || 'kg' });
  } catch (err) {
    next(err);
  }
};

exports.getExerciseProgress = async (req, res, next) => {
  try {
    // Holds are tracked as reps (2 seconds = 1 rep); overcoming isometrics aren't tracked.
    if (!require('mongoose').isValidObjectId(req.params.exerciseId)) return res.json([]);
    const type = (await Exercise.findById(req.params.exerciseId).select('type').lean())?.type || 'dynamic';
    if (type === 'overcoming') return res.json([]);

    // Latest 30 sessions, returned oldest → newest for the chart.
    const sessions = (await WorkoutSession.find({
      user: req.user.id,
      'exercises.exercise': req.params.exerciseId,
    })
      .select('date exercises')
      .sort({ date: -1 })
      .limit(30)).reverse();

    const progress = sessions.map((session) => {
      const ex = session.exercises.find(
        (e) => e.exercise.toString() === req.params.exerciseId
      );
      // Warm-ups aren't progress; a session of only warm-ups is skipped below.
      const sets = ex.sets.filter((s) => !s.warmup).map((s) => asRepSet(s.toObject ? s.toObject() : s, type));
      if (!sets.length) return null;
      const maxWeight = Math.max(...sets.map((s) => s.weight));
      const totalVolume = sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
      // Best estimated 1RM of the session, counting reps in reserve.
      // To one decimal: whole kg hid small changes (15 kg × 7 → 18.5 showed as 19, same as × 8).
      const oneRM = Math.round(Math.max(0, ...sets.map(estimateOneRepMax)) * 10) / 10;

      return { date: session.date, maxWeight, totalVolume, oneRM };
    });

    res.json(progress.filter(Boolean));
  } catch (err) {
    next(err);
  }
};

// GET /api/workouts/:id
exports.getWorkoutById = async (req, res, next) => {
  try {
    const workout = await WorkoutSession.findOne({ _id: req.params.id, user: req.user.id }).populate(
      'exercises.exercise'
    );
    if (!workout) return res.status(404).json({ message: 'Workout not found' });
    res.json(workout);
  } catch (err) {
    next(err);
  }
};

// POST /api/workouts
exports.createWorkout = async (req, res, next) => {
  try {
    // Warm-ups aren't taken near failure, so they have no RIR.
    const exercises = (req.body.exercises || []).map((ex) => ({
      ...ex,
      sets: (ex.sets || []).map((s) => (s.warmup ? { ...s, rir: null } : s)),
    }));
    const workout = await WorkoutSession.create({ ...req.body, exercises, user: req.user.id });
    await workout.populate('exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images');
    res.status(201).json(workout);
  } catch (err) {
    next(err);
  }
};

// PUT /api/workouts/:id
exports.updateWorkout = async (req, res, next) => {
  try {
    const workout = await WorkoutSession.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    ).populate('exercises.exercise', 'name muscleGroups secondaryMuscles equipment laterality type images');
    if (!workout) return res.status(404).json({ message: 'Workout not found' });
    res.json(workout);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/workouts  — wipes the current user's entire workout history
exports.deleteAllWorkouts = async (req, res, next) => {
  try {
    const { deletedCount } = await WorkoutSession.deleteMany({ user: req.user.id });
    res.json({ message: 'Workout history cleared', deletedCount });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/workouts/:id
exports.deleteWorkout = async (req, res, next) => {
  try {
    const workout = await WorkoutSession.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!workout) return res.status(404).json({ message: 'Workout not found' });
    res.json({ message: 'Workout deleted' });
  } catch (err) {
    next(err);
  }
};

// GET /api/workouts/plateaus — exercises that haven't gone up at all in the past month
exports.getPlateaus = async (req, res, next) => {
  try {
    const { findPlateaus, WINDOW_DAYS } = require('../utils/plateaus');
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
    const sessions = await WorkoutSession.find({ user: req.user.id, date: { $gte: since } })
      .select('date exercises')
      .sort({ date: 1 })
      .populate('exercises.exercise', 'name type')
      .lean();
    res.json({ plateaus: findPlateaus(sessions), windowDays: WINDOW_DAYS });
  } catch (err) {
    next(err);
  }
};
