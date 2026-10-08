const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { MEAL_TYPES, DIETS } = require('../utils/nutritionConstants');

// Largest single portion a planned meal can add to the log.
const MAX_PORTION_GRAMS = 2000;
const {
  getLogByDate,
  getLogRange,
  upsertLog,
  addMeal,
  updateMeal,
  deleteMeal,
  updateGoals,
  getHistory,
  deleteLog,
  deleteAllLogs,
  getTargets,
  copyMeals,
  createMealPlan,
  applyMealPlan,
  addWater,
  deleteWater,
  toggleSupplement,
  getSummary,
  takeSupplements,
  setSupplementServings,
  supplementDay,
  tickSupplement,
} = require('../controllers/nutrition.controller');

// GET /api/nutrition?date=2024-01-15
router.get('/', protect, getLogByDate);

// GET /api/nutrition/range?from=2024-01-01&to=2024-01-31
router.get('/range', protect, getLogRange);

// GET /api/nutrition/targets
router.get('/targets', protect, getTargets);

// GET /api/nutrition/history?page=1&limit=10
router.get('/history', protect, getHistory);

// GET /api/nutrition/summary?from=…&to=…  — per-day totals for the Progress charts
router.get('/summary', protect, getSummary);

// Hydration and supplements, kept on the day's log.
router.post('/water', protect, [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('amount').isInt({ min: 1, max: 5000 }).withMessage('Amount must be between 1 and 5000 ml'),
], validate, addWater);
router.delete('/water/:entryId', protect, deleteWater);
router.post('/supplements/day', protect, [
  body('date').isISO8601().withMessage('Valid date is required'),
], validate, supplementDay);
router.post('/supplements/toggle', protect, [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('supplementId').isMongoId().withMessage('Invalid supplement'),
  body('taken').optional().isBoolean().withMessage('taken must be true or false'),
], validate, toggleSupplement);
router.post('/supplements/tick', protect, [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('supplementId').isMongoId().withMessage('Invalid supplement'),
], validate, tickSupplement);
router.put('/supplements/servings', protect, [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('supplementId').isMongoId().withMessage('Invalid supplement'),
  body('servings').isFloat({ min: 0.25, max: 20 }).withMessage('Servings must be between 0.25 and 20'),
], validate, setSupplementServings);
router.post('/supplements/take', protect, [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('supplementIds').optional().isArray({ max: 50 }).withMessage('Supplements must be a list'),
  body('supplementIds.*').optional().isMongoId().withMessage('Invalid supplement'),
  body('copyFrom').optional().isISO8601().withMessage('Valid date to copy from is required'),
], validate, takeSupplements);

router.delete('/', protect, deleteAllLogs);
router.delete('/:id', protect, deleteLog);

router.post(
  '/',
  protect,
  [
    body('date').isISO8601().withMessage('Valid date is required'),
  ],
  validate,
  upsertLog
);

router.post(
  '/meal-plan',
  protect,
  [
    body('mealsPerDay').optional().isInt({ min: 3, max: 5 }).withMessage('Meals per day must be 3–5'),
    body('diet').optional().isIn(DIETS).withMessage('Unknown diet'),
    body('days').optional().isInt({ min: 1, max: 7 }).withMessage('Days must be 1–7'),
    body('seed').optional().isInt({ min: 0 }).withMessage('Seed must be a whole number'),
  ],
  validate,
  createMealPlan
);

router.post(
  '/meal-plan/apply',
  protect,
  [
    body('date').optional().isISO8601().withMessage('Valid date is required'),
    body('meals')
      .isArray({ min: 1 }).withMessage('Meals are required')
      .custom((meals) => meals.some((meal) => Array.isArray(meal?.foods) && meal.foods.length > 0))
      .withMessage('Nothing to add'),
    body('meals.*.mealType').isIn(MEAL_TYPES).withMessage('Invalid meal type'),
    body('meals.*.foods').isArray().withMessage('Each meal needs a list of foods'),
    body('meals.*.foods.*.foodId').isMongoId().withMessage('Invalid food'),
    body('meals.*.foods.*.grams').isFloat({ gt: 0, max: MAX_PORTION_GRAMS }).withMessage(`Portions must be more than 0 g and at most ${MAX_PORTION_GRAMS} g`),
  ],
  validate,
  applyMealPlan
);

router.post(
  '/copy',
  protect,
  [
    body('fromDate').isISO8601().withMessage('Valid date to copy from is required'),
    body('toDate').isISO8601().withMessage('Valid date to copy to is required'),
    body('mealTypes').optional().isArray().withMessage('Meal types must be a list'),
    body('mealTypes.*').optional().isIn(MEAL_TYPES).withMessage('Invalid meal type'),
  ],
  validate,
  copyMeals
);

router.post(
  '/:id/meals',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Meal name is required'),
    body('calories').isNumeric().withMessage('Calories must be a number'),
    body('mealType')
      .optional()
      .isIn(MEAL_TYPES)
      .withMessage('Invalid meal type'),
  ],
  validate,
  addMeal
);

router.put('/:id/meals/:mealId', protect, updateMeal);
router.delete('/:id/meals/:mealId', protect, deleteMeal);
router.put('/:id/goals', protect, updateGoals);

module.exports = router;
