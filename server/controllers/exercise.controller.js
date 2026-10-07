const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
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

    const exercises = await Exercise.find(filter).sort({ name: 1 });
    res.json(exercises);
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
    const FIELDS = ['name', 'muscleGroups', 'secondaryMuscles', 'equipment', 'category', 'instructions', 'laterality', 'type', 'gifUrl'];
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
    res.json({ message: 'Exercise deleted' });
  } catch (err) {
    next(err);
  }
};
