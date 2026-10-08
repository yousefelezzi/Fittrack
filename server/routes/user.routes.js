const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getUserById,
  updateMe,
  uploadAvatar,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  getSuggestions,
  getFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
} = require('../controllers/user.controller');
const { getUserStats } = require('../controllers/stats.controller');

router.get('/search', protect, searchUsers);
// Before /:id so "me" isn't taken for a user id.
router.get('/me/follow-requests', protect, getFollowRequests);
router.post('/me/follow-requests/:id', protect, acceptFollowRequest);
router.delete('/me/follow-requests/:id', protect, declineFollowRequest);
router.get('/suggestions', protect, getSuggestions);
router.get('/:id', protect, getUserById);
router.get('/:id/stats', protect, getUserStats);
router.get('/:id/followers', protect, getFollowers);
router.get('/:id/following', protect, getFollowing);

router.put(
  '/me',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('height').optional().isNumeric().withMessage('Height must be a number'),
    body('weight').optional().isFloat({ min: 20, max: 400 }).withMessage('Weight must be between 20 and 400 kg'),
    body('weightDate').optional().isISO8601().withMessage('Invalid date'),
    body('bodyWeightUnit').optional().isIn(['kg', 'lb']).withMessage('Unit must be kg or lb'),
    body('adaptiveCalories').optional().isBoolean().withMessage('Must be true or false'),
    body('heightUnit').optional().isIn(['cm', 'ft']).withMessage('Height unit must be cm or ft'),
    body('bodyFat').optional({ nullable: true }).isFloat({ min: 3, max: 70 }).withMessage('Body fat must be between 3 and 70%'),
    body('sex').optional({ nullable: true }).isIn(['male', 'female']).withMessage('Sex must be male or female'),
    body('activityLevel').optional({ nullable: true }).isIn([1.2, 1.375, 1.55, 1.725, 1.9]).withMessage('Invalid activity level'),
    body('waterType').optional().isIn(['tap', 'mineral', 'filtered']).withMessage('Water type must be tap, mineral or filtered'),
    body('waterGoal').optional({ nullable: true }).isInt({ min: 500, max: 8000 }).withMessage('Water goal must be between 500 and 8000 ml'),
    body('weightUnit').optional().isIn(['kg', 'lb']).withMessage('Unit must be kg or lb'),
    body('stepGoal').optional().isInt({ min: 1000, max: 50000 }).withMessage('Step goal must be between 1,000 and 50,000'),
    body('statsVisibility').optional().isObject().withMessage('Invalid visibility settings'),
    body('privacy').optional().isObject().withMessage('Invalid privacy settings'),
    body('privacy.messages').optional().isIn(['connections', 'following', 'nobody']).withMessage('Invalid message setting'),
    body('fitnessGoal')
      .optional()
      .isIn(['lose_weight', 'build_muscle', 'improve_endurance', 'stay_active', 'other'])
      .withMessage('Invalid fitness goal'),
  ],
  validate,
  updateMe
);

router.post('/me/avatar', protect, upload.single('avatar'), uploadAvatar);
router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);

module.exports = router;
