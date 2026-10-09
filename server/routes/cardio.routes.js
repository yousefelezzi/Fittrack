const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { ACTIVITIES, INTENSITIES } = require('../utils/cardio');
const { getCardio, createCardio, deleteCardio } = require('../controllers/cardio.controller');

router.get('/', protect, getCardio);
router.post('/', protect, [
  body('activity').isIn(Object.keys(ACTIVITIES)).withMessage('Pick an activity'),
  body('intensity').optional().isIn(INTENSITIES).withMessage('Intensity must be easy, moderate or hard'),
  body('minutes').isFloat({ min: 1, max: 600 }).withMessage('Minutes must be between 1 and 600'),
  body('distanceKm').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 500 }).withMessage('Distance must be between 0 and 500 km'),
  body('date').optional().isISO8601().withMessage('Invalid date'),
  body('notes').optional().isString().isLength({ max: 300 }).withMessage('Notes can be up to 300 characters'),
], validate, createCardio);
router.delete('/:id', protect, [param('id').isMongoId().withMessage('Invalid cardio session')], validate, deleteCardio);

module.exports = router;
