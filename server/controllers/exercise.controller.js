const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
const ExerciseRating = require('../models/ExerciseRating');

/**
 * Ratings for exercises: Map id → { avg (1 decimal), count, mine (your stars or null) }.
 * `ids` limits it to some exercises (all when left out).
 */
async function ratingsFor(userId, ids) {
  const match = ids ? { exercise: { $in: ids.map((id) => new mongoose.Types.ObjectId(String(id))) } } : {};
  const [totals, mine] = await Promise.all([
    ExerciseRating.aggregate([{ $match: match }, { $group: { _id: '$exercise', avg: { $avg: '$stars' }, count: { $sum: 1 } } }]),
    ExerciseRating.find({ ...match, user: userId }).select('exercise stars').lean(),
  ]);
  const out = new Map(totals.map((t) => [String(t._id), { avg: Math.round(t.avg * 10) / 10, count: t.count, mine: null }]));
  for (const m of mine) {
    const r = out.get(String(m.exercise)) || { avg: m.stars, count: 1, mine: null };
    out.set(String(m.exercise), { ...r, mine: m.stars });
  }
  return out;
}
const NO_RATING = { avg: null, count: 0, mine: null };
const splitUnilateralSets = require('../utils/splitUnilateralSets');
const { similarExercises } = require('../utils/similarExercises');

// GET /api/exercises
exports.getAllExercises = async (req, res, next) => {
  try {
    const { muscle, equipment, search } = req.query;
    const filter = {
      $or: [{ isCustom: false }, { isCustom: true, createdBy: req.user.id }],
    };

    if (muscle) filter.muscleGroups = muscle;
    if (equipment) filter.equipment = equipment;
    if (search) filter.$text = { $search: search };

    const [exercises, ratings] = await Promise.all([Exercise.find(filter).sort({ name: 1 }), ratingsFor(req.user.id)]);
    res.json(exercises.map((e) => ({ ...e.toJSON(), rating: ratings.get(String(e._id)) || NO_RATING })));
  } catch (err) {
    next(err);
  }
};

// GET /api/exercises/:id
exports.getExerciseById = async (req, res, next) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) return res.status(404).json({ message: 'Exercise not found' });
    res.json(exercise);
  } catch (err) {
    next(err);
  }
};

// POST /api/exercises  (custom exercise)
exports.createCustomExercise = async (req, res, next) => {
  try {
    const exercise = await Exercise.create({
      ...req.body,
      category: 'strength', // cardio is logged on its own page
      isCustom: true,
      createdBy: req.user.id,
    });
    res.status(201).json(exercise);
  } catch (err) {
    next(err);
  }
};

// GET /api/exercises/:id/similar?equipment=barbell,dumbbell
// Exercises that could replace this one (built-in and your own), best first.
exports.getSimilarExercises = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Exercise not found' });
    const scope = { $or: [{ isCustom: false }, { isCustom: true, createdBy: req.user.id }] };
    const target = await Exercise.findOne({ _id: req.params.id, ...scope }).lean();
    if (!target) return res.status(404).json({ message: 'Exercise not found' });
    const candidates = await Exercise.find(scope).select('name muscleGroups secondaryMuscles equipment laterality type category isCustom images').lean();
    const equipment = req.query.equipment ? String(req.query.equipment).split(',').filter(Boolean) : undefined;
    res.json(similarExercises(target, candidates, { equipment, limit: Math.min(20, Number(req.query.limit) || 8) }));
  } catch (err) {
    next(err);
  }
};

// PUT /api/exercises/:id
exports.updateExercise = async (req, res, next) => {
  try {
    const exercise = await Exercise.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!exercise) return res.status(404).json({ message: 'Exercise not found or not yours to edit' });

    // Only the exercise's own fields can change (not ownership or isCustom).
    const FIELDS = ['name', 'muscleGroups', 'secondaryMuscles', 'equipment', 'instructions', 'laterality', 'type', 'gifUrl'];
    for (const key of FIELDS) if (req.body[key] !== undefined) exercise[key] = req.body[key];

    // Secondary muscles must still be among the muscle groups.
    exercise.secondaryMuscles = (exercise.secondaryMuscles || []).filter((m) => exercise.muscleGroups.includes(m));
    const becameUnilateral = exercise.isModified('laterality') && exercise.laterality === 'unilateral';
    await exercise.save();

    // Sets logged while it was bilateral have no side: split them into matching
    // left + right entries, the same as for built-in exercises.
    if (becameUnilateral) await splitUnilateralSets(mongoose.connection.db, [exercise._id]);

    res.json(exercise);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/exercises/:id
exports.deleteExercise = async (req, res, next) => {
  try {
    const exercise = await Exercise.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
    if (!exercise) return res.status(404).json({ message: 'Exercise not found or not yours to delete' });
    await ExerciseRating.deleteMany({ exercise: exercise._id });
    res.json({ message: 'Exercise deleted' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/exercises/:id/rating { stars }  — rate an exercise 1–5, or 0 to take your rating back
exports.rateExercise = async (req, res, next) => {
  try {
    const exercise = await Exercise.findOne({ _id: req.params.id, $or: [{ isCustom: false }, { createdBy: req.user.id }] }).select('_id').lean();
    if (!exercise) return res.status(404).json({ message: 'Exercise not found' });
    const stars = Number(req.body.stars);
    if (stars === 0) await ExerciseRating.deleteOne({ exercise: exercise._id, user: req.user.id });
    else {
      await ExerciseRating.findOneAndUpdate(
        { exercise: exercise._id, user: req.user.id },
        { $set: { stars }, $setOnInsert: { exercise: exercise._id, user: req.user.id } },
        { upsert: true, runValidators: true }
      );
    }
    const ratings = await ratingsFor(req.user.id, [exercise._id]);
    res.json(ratings.get(String(exercise._id)) || NO_RATING);
  } catch (err) {
    next(err);
  }
};

// POST /api/exercises/from-shared { exerciseId, postId?, messageId? }
// Save a custom exercise someone shared (in a post you can see or a message in
// your chats) to your own exercises. Your own one with the same name is reused.
exports.saveSharedExercise = async (req, res, next) => {
  try {
    const { usableExercise, canSeeShared } = require('../utils/sharing');
    const me = String(req.user.id);
    const { exerciseId, postId, messageId } = req.body;
    const source = await Exercise.findById(exerciseId).lean();
    const allowed = source && (String(source.createdBy) === me || !source.isCustom
      || await canSeeShared(me, { postId, messageId, field: 'exercise', id: exerciseId }));
    if (!allowed) return res.status(404).json({ message: 'Exercise not found' });
    const mine = await usableExercise(source, me);
    res.status(201).json(mine);
  } catch (err) {
    next(err);
  }
};
