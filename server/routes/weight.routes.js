const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { getWeights, logWeight, deleteWeight } = require('../controllers/weight.controller');

router.get('/', protect, getWeights);
router.post('/', protect, [
  body('date').isISO8601().withMessage('Valid date is required')
    .custom((v) => new Date(v).getTime() <= Date.now() + 36 * 3600000).withMessage("You can't log a future day"),
  body('weight').isFloat({ min: 20, max: 400 }).withMessage('Weight must be between 20 and 400 kg'),
], validate, logWeight);
router.delete('/:id', protect, deleteWeight);

module.exports = router;
