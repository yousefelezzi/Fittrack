const express  = require('express');
const router   = express.Router();
const protect  = require('../middleware/auth');
const { search, getById, create, update } = require('../controllers/food.controller');

// All routes require auth
router.get('/search', protect, search);
router.get('/:id',    protect, getById);
router.post('/',      protect, create);
router.put('/:id',    protect, update);

module.exports = router;
