const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  startPlan,
  setActivePlan,
  generatePlan,
  analyzePlan,
  planSkeleton,
  saveWorkoutAsPlan,
} = require('../controllers/plan.controller');

router.get('/', protect, getPlans);
// Save a workout (yours, or one shared with you in a post or message) as a template.
router.post('/from-workout', protect, [
  body('workoutId').isMongoId().withMessage('Invalid workout'),
  body('postId').optional().isMongoId().withMessage('Invalid post'),
  body('messageId').optional().isMongoId().withMessage('Invalid message'),
], validate, saveWorkoutAsPlan);
router.post(
  '/generate',
  protect,
  [
    body('daysPerWeek').optional().isInt({ min: 2, max: 6 }).withMessage('Days per week must be 2–6'),
    body('split').optional().isIn(['fb', 'eod', 'ul', 'fb_ul', 'ul_ppl', 'ppl']).withMessage('Unknown split'),
    body('preferCustom').optional().isBoolean(),
    body('level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Unknown level'),
    body('exclude').optional().isArray().withMessage('Excluded muscles must be a list'),
    body('variation').optional().isIn(['ab', 'repeat']).withMessage('Variation must be ab or repeat'),
    body('maxSets').optional().isInt({ min: 4, max: 40 }).withMessage('Sets per session must be 4–40'),
    body('maxExercises').optional().isInt({ min: 2, max: 12 }).withMessage('Exercises per session must be 2–12'),
    body('equipment').optional().isArray().withMessage('Equipment must be a list'),
    body('priorities').optional().isArray().withMessage('Priorities must be a list'),
  ],
  validate,
  generatePlan
);
router.post(
  '/skeleton',
  protect,
  [
    body('daysPerWeek').optional().isInt({ min: 2, max: 6 }).withMessage('Days per week must be 2–6'),
    body('split').optional().isIn(['fb', 'eod', 'ul', 'fb_ul', 'ul_ppl', 'ppl']).withMessage('Unknown split'),
    body('variation').optional().isIn(['ab', 'repeat']).withMessage('Variation must be ab or repeat'),
  ],
  validate,
  planSkeleton
);
router.post('/analyze', protect, [body('days').isArray().withMessage('Days must be a list')], validate, analyzePlan);
router.get('/:id', protect, getPlanById);

router.post(
  '/',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Plan name is required'),
    body('days').isArray().withMessage('Days must be an array'),
  ],
  validate,
  createPlan
);

router.put('/:id', protect, updatePlan);
router.delete('/:id', protect, deletePlan);

// Clone a plan into a live WorkoutSession and return it
router.post('/:id/start', protect, startPlan);

// Mark a plan as the user's currently active plan
router.patch('/:id/activate', protect, setActivePlan);

module.exports = router;
