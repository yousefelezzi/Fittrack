const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { ACTIVITIES, INTENSITIES } = require('../utils/cardio');
const {
  getCardio, createCardio, deleteCardio, getActivities, createActivity, deleteActivity,
} = require('../controllers/cardio.controller');

router.get('/', protect, getCardio);
router.get('/activities', protect, getActivities);
router.post('/activities', protect, [
  body('name').isString().trim().isLength({ min: 1, max: 40 }).withMessage('Name it (up to 40 characters)'),
  body('base').isIn(Object.keys(ACTIVITIES)).withMessage('Pick the activity it\'s most like'),
], validate, createActivity);
router.delete('/activities/:id', protect, [param('id').isMongoId().withMessage('Invalid activity')], validate, deleteActivity);
router.post('/', protect, [
  body('activity').optional().isIn(Object.keys(ACTIVITIES)).withMessage('Pick an activity'),
  body('customActivity').optional().isMongoId().withMessage('Invalid activity'),
  body('intensity').optional().isIn(INTENSITIES).withMessage('Intensity must be easy, moderate or hard'),
  body('minutes').optional().isFloat({ min: 1, max: 600 }).withMessage('Minutes must be between 1 and 600'),
  body('segments').optional().isArray({ max: 500 }).withMessage('Invalid session'),
  body('segments.*.intensity').optional().isIn(INTENSITIES).withMessage('Invalid intensity'),
  body('segments.*.seconds').optional().isFloat({ min: 0, max: 36000 }).withMessage('Invalid time'),
  body('distanceKm').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 500 }).withMessage('Distance must be between 0 and 500 km'),
  body('date').optional().isISO8601().withMessage('Invalid date'),
  body('notes').optional().isString().isLength({ max: 300 }).withMessage('Notes can be up to 300 characters'),
], validate, createCardio);
router.delete('/:id', protect, [param('id').isMongoId().withMessage('Invalid cardio session')], validate, deleteCardio);

module.exports = router;
