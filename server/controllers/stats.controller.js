const mongoose = require('mongoose');
const User = require('../models/User');
const WorkoutSession = require('../models/WorkoutSession');
const NutritionLog = require('../models/NutritionLog');
const StepLog = require('../models/StepLog');
const WorkoutPlan = require('../models/WorkoutPlan');
const { estimateOneRepMax, effectiveReps, countsForOneRepMax, asRepSet } = require('../utils/oneRepMax');
const { canViewContent } = require('../utils/privacy');

const STAT_KEYS = ['avgCalories', 'avgSteps', 'ffmi', 'split', 'oneRepMaxes'];
const WINDOW_DAYS = 30;

// The exercise library uses fine-grained muscles; the split view groups them
// into the body regions people actually talk about.
const REGION_OF = {
  pecs: 'Chest', 'clavicular pecs': 'Chest', 'costal pecs': 'Chest',
  lats: 'Back', trapezius: 'Back', erectors: 'Back',
  'anterior delt': 'Shoulders', 'middle delt': 'Shoulders', 'posterior delt': 'Shoulders',
  'elbow flexors': 'Arms', biceps: 'Arms', 'brachialis/brachioradialis': 'Arms', triceps: 'Arms', 'medial/lateral triceps': 'Arms', 'triceps long head': 'Arms', forearms: 'Arms',
  quads: 'Legs', 'vastus quads': 'Legs', 'rectus femoris': 'Legs', hamstrings: 'Legs', 'biarticular hamstrings': 'Legs', 'hamstrings short head': 'Legs', glutes: 'Legs', adductors: 'Legs',
  'hip flexors': 'Legs', calves: 'Legs', gastrocnemius: 'Legs', soleus: 'Legs',
  abs: 'Core',
};

// Same thresholds as the FFMI calculator page (client-web/src/utils/calculators.js).
const FFMI_CATEGORIES = [
  { max: 18, label: 'Below average' },
  { max: 20, label: 'Average' },
  { max: 22, label: 'Above average' },
  { max: 23, label: 'Excellent' },
  { max: 26, label: 'Superior' },
  { max: 28, label: 'Suspicion of enhancement' },
  { max: Infinity, label: 'Very unlikely natural' },
];

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const round1 = (n) => Math.round(n * 10) / 10;

// ── Individual stats ────────────────────────────────────────────────────────

async function avgCalories(userId) {
  const logs = await NutritionLog.find({ user: userId, date: { $gte: daysAgo(WINDOW_DAYS) } })
    .select('meals.calories')
    .lean();
  // Only count days where something was actually logged.
  const days = logs.filter((l) => l.meals?.length > 0);
  if (days.length === 0) return null;
  const total = days.reduce((sum, l) => sum + l.meals.reduce((s, m) => s + (m.calories || 0), 0), 0);
  return { average: Math.round(total / days.length), daysLogged: days.length, periodDays: WINDOW_DAYS };
}

async function avgSteps(user) {
  const logs = await StepLog.find({ user: user._id, date: { $gte: daysAgo(WINDOW_DAYS) } }).select('steps').lean();
  if (logs.length === 0) return null;
  const total = logs.reduce((sum, l) => sum + l.steps, 0);
  const goal = user.stepGoal || 10000;
  return {
    average: Math.round(total / logs.length),
    goal,
    daysAtGoal: logs.filter((l) => l.steps >= goal).length,
    daysLogged: logs.length,
    periodDays: WINDOW_DAYS,
  };
}

function ffmi(user, isOwner) {
  const missing = [];
  if (!user.height) missing.push('height');
  if (!user.weight) missing.push('weight');
  if (user.bodyFat == null) missing.push('bodyFat');
  if (missing.length) return isOwner ? { missing } : null;

  const heightM = user.height / 100;
  const ffm = user.weight * (1 - user.bodyFat / 100);
  const value = ffm / (heightM * heightM);
  const normalized = value + 6.1 * (1.8 - heightM);
  const category = FFMI_CATEGORIES.find((c) => normalized < c.max).label;

  // Other people see the index, not the body-fat % or weight behind it.
  return { ffmi: round1(value), normalizedFfmi: round1(normalized), category };
}

async function split(userId) {
  const [plan, sessions] = await Promise.all([
    WorkoutPlan.findOne({ user: userId, isActive: true }).select('name days.dayOfWeek days.label').lean(),
    WorkoutSession.find({ user: userId, date: { $gte: daysAgo(WINDOW_DAYS) } })
      .select('exercises')
      .populate('exercises.exercise', 'muscleGroups secondaryMuscles')
      .lean(),
  ]);

  // Each set counts once, toward the exercise's primary muscle (the first one
  // listed — e.g. bench press is ['pecs', 'triceps', 'anterior delt'] → Chest).
  // Counting secondary muscles too would inflate compound upper-body lifts and
  // make the split drift from what was actually trained.
  const setsByRegion = {};
  let totalSets = 0;
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const primary = (ex.exercise?.muscleGroups || []).map((m) => REGION_OF[m]).find(Boolean);
      if (!primary) continue;
      // Unilateral sets are saved as left + right entries; count each pair once.
      const setCount = ex.sets.filter((st) => st.side !== 'right' && !st.warmup).length; // warm-ups don't count
      setsByRegion[primary] = (setsByRegion[primary] || 0) + setCount;
      totalSets += setCount;
    }
  }

  if (!plan && sessions.length === 0) return null;

  const breakdown = Object.entries(setsByRegion)
    .map(([region, sets]) => ({ region, sets, percent: Math.round((sets / totalSets) * 100) }))
    .sort((a, b) => b.sets - a.sets);

  return {
    plan: plan
      ? {
          name: plan.name,
          days: [...plan.days].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((d) => ({ dayOfWeek: d.dayOfWeek, label: d.label })),
        }
      : null,
    workoutsPerWeek: round1(sessions.length / (WINDOW_DAYS / 7)),
    totalSets,
    breakdown,
    periodDays: WINDOW_DAYS,
  };
}

/**
 * Each exercise's current 1RM: the best estimate from the most recent session
 * with a usable set, so it goes down as well as up. When an older session
 * estimated higher, that all-time best comes along as `best`.
 */
async function oneRepMaxes(userId) {
  const sessions = await WorkoutSession.find({ user: userId })
    .select('date exercises')
    .sort({ date: 1 })
    .populate('exercises.exercise', 'name type')
    .lean();

  const byExercise = new Map(); // id → { current, best }
  for (const session of sessions) {
    // This session's best set per exercise (an exercise split by "do it later" counts once).
    const sessionBest = new Map();
    for (const ex of session.exercises) {
      if (!ex.exercise) continue; // exercise was deleted from the library
      // Holds count 2 seconds as 1 rep; overcoming isometrics have no 1RM.
      if (ex.exercise.type === 'overcoming') continue;
      for (const logged of ex.sets) {
        const set = asRepSet(logged, ex.exercise.type);
        // Skips warm-ups, 0 kg sets and ones too far from failure to estimate well.
        if (set.warmup || !countsForOneRepMax(set)) continue;
        // Reps in reserve count as reps (5 @ 1 RIR = 6-rep max). Same as the Progress page.
        const e1rm = estimateOneRepMax(set);
        const id = String(ex.exercise._id);
        if (!sessionBest.has(id) || e1rm > sessionBest.get(id).oneRepMax) {
          sessionBest.set(id, {
            exerciseId: id,
            name: ex.exercise.name,
            oneRepMax: round1(e1rm),
            isEstimate: effectiveReps(set) !== 1,
            fromSet: {
              weight: set.weight, reps: set.reps, rir: set.rir ?? null, side: set.side ?? null,
              // A hold, shown as held (16s @ 2s in reserve) rather than as reps.
              ...(ex.exercise.type === 'yielding' && { duration: logged.duration ?? 0, sir: logged.sir ?? null }),
            },
            date: session.date,
          });
        }
      }
    }
    // Sessions are oldest first, so each one becomes the current 1RM.
    for (const [id, entry] of sessionBest) {
      const prev = byExercise.get(id);
      const best = !prev || entry.oneRepMax >= prev.best.oneRepMax ? { oneRepMax: entry.oneRepMax, date: entry.date } : prev.best;
      byExercise.set(id, { current: entry, best });
    }
  }

  if (byExercise.size === 0) return null;
  return [...byExercise.values()]
    .map(({ current, best }) => ({ ...current, ...(best.oneRepMax > current.oneRepMax && { best }) }))
    .sort((a, b) => b.oneRepMax - a.oneRepMax);
}

// ── GET /api/users/:id/stats ────────────────────────────────────────────────

exports.getUserStats = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found' });

    const user = await User.findById(req.params.id).select('height weight bodyFat stepGoal statsVisibility privacy followers following').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isOwner = String(user._id) === String(req.user.id);
    const visibility = Object.fromEntries(STAT_KEYS.map((k) => [k, !!user.statsVisibility?.[k]]));

    // Private stats aren't computed at all for other viewers, so nothing leaks.
    // A private account's public stats are for its followers only.
    const followerView = canViewContent(user, req.user.id);
    const include = (key) => isOwner || (followerView && visibility[key]);

    const [calories, steps, splitData, maxes] = await Promise.all([
      include('avgCalories') ? avgCalories(user._id) : undefined,
      include('avgSteps') ? avgSteps(user) : undefined,
      include('split') ? split(user._id) : undefined,
      include('oneRepMaxes') ? oneRepMaxes(user._id) : undefined,
    ]);

    const stats = {};
    if (include('avgCalories')) stats.avgCalories = calories;
    if (include('avgSteps')) stats.avgSteps = steps;
    if (include('ffmi')) stats.ffmi = ffmi(user, isOwner);
    if (include('split')) stats.split = splitData;
    if (include('oneRepMaxes')) stats.oneRepMaxes = maxes;

    res.json({ isOwner, ...(isOwner ? { visibility } : {}), stats });
  } catch (err) {
    next(err);
  }
};

exports.STAT_KEYS = STAT_KEYS;
