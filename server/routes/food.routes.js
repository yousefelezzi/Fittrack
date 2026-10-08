const express  = require('express');
const router   = express.Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const protect  = require('../middleware/auth');
const { search, getById, create, update, getMine, saveFood, unsaveFood } = require('../controllers/food.controller');

// All routes require auth
router.get('/search', protect, search);
// Your custom foods and recipes, and ones you saved from others (before /:id).
router.get('/mine',   protect, getMine);
router.post('/saved', protect, [
  body('foodId').isMongoId().withMessage('Invalid food'),
  body('postId').optional().isMongoId().withMessage('Invalid post'),
  body('messageId').optional().isMongoId().withMessage('Invalid message'),
], validate, saveFood);
router.delete('/saved/:id', protect, [param('id').isMongoId().withMessage('Invalid food')], validate, unsaveFood);
router.get('/:id',    protect, getById);
router.post('/',      protect, create);
router.put('/:id',    protect, update);

module.exports = router;
