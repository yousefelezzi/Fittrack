const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const {
  createWorkout,
  getWorkouts,
  getWorkoutById,
  updateWorkout,
  deleteWorkout,
  deleteAllWorkouts,
  getWorkoutStats,
  getMuscleSessions,
  getExerciseProgress,
  getLastSets,
} = require('../controllers/workout.controller');

// GET /api/workouts?page=1&limit=10&from=2024-01-01&to=2024-12-31
router.get('/', protect, getWorkouts);
router.get('/stats', protect, getWorkoutStats);
router.get('/muscle-sessions', protect, getMuscleSessions);
router.get('/progress/:exerciseId', protect, getExerciseProgress);
router.get('/last/:exerciseId', protect, getLastSets);
router.get('/:id', protect, getWorkoutById);

router.post(
  '/',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Workout name is required'),
    body('exercises').isArray({ min: 1 }).withMessage('At least one exercise is required'),
    body('exercises.*.exercise').notEmpty().withMessage('Exercise ID is required'),
    body('exercises.*.sets').isArray({ min: 1 }).withMessage('At least one set is required'),
    body('exercises.*.sets.*.reps').isInt({ min: 1 }).withMessage('Reps must be a positive integer'),
    body('exercises.*.sets.*.weight').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Weight must be 0 or more'),
    body('exercises.*.sets.*.side').optional({ nullable: true }).isIn(['left', 'right']).withMessage('Side must be left or right'),
    body('exercises.*.sets.*.rir').optional({ nullable: true }).isInt({ min: 0, max: 10 }).withMessage('RIR must be a whole number from 0 to 10'),
    body('exercises.*.weightUnit').optional().isIn(['kg', 'lb']).withMessage('Unit must be kg or lb'),
    body('exercises.*.sets.*.warmup').optional().isBoolean().withMessage('Warm-up must be true or false'),
    body('exercises.*.sets.*.restTime').optional({ nullable: true }).isInt({ min: 0, max: 3600 }).withMessage('Rest must be between 0 and 60 minutes'),
    // Past workouts can be logged with their own date, but not a future one.
    body('date').optional().isISO8601().withMessage('Invalid date')
      .custom((v) => new Date(v).getTime() <= Date.now() + 60 * 1000).withMessage("A workout can't be in the future"),
  ],
  validate,
  createWorkout
);

router.put('/:id', protect, updateWorkout);
router.delete('/', protect, deleteAllWorkouts);
router.delete('/:id', protect, deleteWorkout);

module.exports = router;
