const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const {
  getAllExercises,
  getExerciseById,
  createCustomExercise,
  updateExercise,
  deleteExercise,
  getSimilarExercises,
} = require('../controllers/exercise.controller');

// GET /api/exercises?muscle=pecs&equipment=barbell&search=bench
router.get('/', protect, getAllExercises);
router.get('/:id/similar', protect, getSimilarExercises);
router.get('/:id', protect, getExerciseById);

router.post(
  '/',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Exercise name is required'),
    body('category').optional().isIn(['strength', 'cardio']).withMessage('Category must be strength or cardio'),
    body('muscleGroups').isArray().withMessage('Muscle groups must be a list')
      .custom((v, { req }) => req.body.category === 'cardio' || v.length > 0)
      .withMessage('At least one muscle group is required'),
    body('equipment').optional().isString(),
    body('secondaryMuscles').optional().isArray().withMessage('Secondary muscles must be a list'),
    body('laterality').optional().isIn(['bilateral', 'unilateral']).withMessage('Type must be bilateral or unilateral'),
    body('type').optional().isIn(['dynamic', 'yielding', 'overcoming']).withMessage('Type must be dynamic, yielding or overcoming'),
  ],
  validate,
  createCustomExercise
);

router.put(
  '/:id',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Exercise name is required'),
    body('category').optional().isIn(['strength', 'cardio']).withMessage('Category must be strength or cardio'),
    body('muscleGroups').optional().isArray().withMessage('Muscle groups must be a list')
      .custom((v, { req }) => req.body.category === 'cardio' || v.length > 0)
      .withMessage('At least one muscle group is required'),
    body('equipment').optional().isString(),
    body('secondaryMuscles').optional().isArray().withMessage('Secondary muscles must be a list'),
    body('laterality').optional().isIn(['bilateral', 'unilateral']).withMessage('Type must be bilateral or unilateral'),
    body('type').optional().isIn(['dynamic', 'yielding', 'overcoming']).withMessage('Type must be dynamic, yielding or overcoming'),
  ],
  validate,
  updateExercise
);
router.delete('/:id', protect, deleteExercise);

module.exports = router;
