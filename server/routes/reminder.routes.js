const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { today } = require('../controllers/reminder.controller');

router.get('/today', protect, [
  query('date').isISO8601().withMessage('Valid date is required'),
  query('weekday').isInt({ min: 0, max: 6 }).withMessage('Weekday must be 0 (Sunday) to 6'),
  query('from').isISO8601().withMessage('Valid start of day is required'),
  query('to').isISO8601().withMessage('Valid end of day is required'),
], validate, today);

module.exports = router;
