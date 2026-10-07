const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { getSupplements, getCatalog, createSupplement, updateSupplement, deleteSupplement } = require('../controllers/supplement.controller');

// A name is needed unless it comes from the built-in list (catalogId).
const fields = (required) => [
  (required ? body('name').if(body('catalogId').not().exists()) : body('name').optional()).isString().trim().isLength({ min: 1, max: 60 }).withMessage('Name must be 1–60 characters'),
  body('catalogId').optional().isMongoId().withMessage('Invalid supplement'),
  body('servings').optional().isFloat({ min: 0.25, max: 20 }).withMessage('Servings must be between 0.25 and 20'),
  body('micros').optional().isObject().withMessage('Micros must be an object of amounts'),
  body('dose').optional().isString().isLength({ max: 40 }).withMessage('Dose must be at most 40 characters'),
  body('timing').optional().isString().isLength({ max: 40 }).withMessage('Timing must be at most 40 characters'),
];
const validId = param('id').isMongoId().withMessage('Invalid supplement');

router.get('/', protect, getSupplements);
router.get('/catalog', protect, getCatalog);
router.post('/', protect, fields(true), validate, createSupplement);
router.put('/:id', protect, [validId, ...fields(false)], validate, updateSupplement);
router.delete('/:id', protect, [validId], validate, deleteSupplement);

module.exports = router;
