const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { getSteps, setSteps, syncSteps } = require('../controllers/steps.controller');

// GET /api/steps?from=2024-01-01&to=2024-01-31
router.get('/', protect, getSteps);

router.put(
  '/',
  protect,
  [
    body('date').isISO8601().withMessage('Valid date is required'),
    body('steps').isInt({ min: 0, max: 200000 }).withMessage('Steps must be a whole number from 0 to 200,000'),
  ],
  validate,
  setSteps
);

router.put(
  '/sync',
  protect,
  [
    body('days').isArray({ min: 1, max: 400 }).withMessage('days must be a list of 1 to 400 days'),
    body('days.*.date').isISO8601().withMessage('Valid date is required'),
    body('days.*.steps').isInt({ min: 0, max: 200000 }).withMessage('Steps must be a whole number from 0 to 200,000'),
  ],
  validate,
  syncSteps
);

module.exports = router;
