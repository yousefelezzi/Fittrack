const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getFeed,
  getUserPosts,
  getPostById,
  createPost,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  editComment,
  editPost,
  deleteComment,
} = require('../controllers/post.controller');

// GET /api/posts/feed?page=1&limit=10
router.get('/feed', protect, getFeed);
router.get('/user/:userId', protect, getUserPosts);
router.get('/:id', protect, getPostById);

router.post(
  '/',
  protect,
  upload.single('image'),
  [
    body('caption').optional().trim().isLength({ max: 500 }).withMessage('Caption too long'),
    body('workoutSession').optional().isMongoId().withMessage('Invalid workout session ID'),
  ],
  validate,
  createPost
);

router.put(
  '/:id',
  protect,
  [body('caption').optional({ nullable: true }).isString().trim().isLength({ max: 500 }).withMessage('Caption too long')],
  validate,
  editPost
);
router.delete('/:id', protect, deletePost);

router.post('/:id/like', protect, likePost);
router.delete('/:id/like', protect, unlikePost);

router.post(
  '/:id/comments',
  protect,
  [
    body('text').trim().notEmpty().withMessage('Comment text is required').isLength({ max: 500 }).withMessage('Comment too long'),
    body('parentId').optional({ nullable: true }).isMongoId().withMessage('Invalid comment'),
  ],
  validate,
  addComment
);

router.put(
  '/:id/comments/:commentId',
  protect,
  [body('text').trim().notEmpty().withMessage('Comment text is required').isLength({ max: 500 }).withMessage('Comment too long')],
  validate,
  editComment
);

router.delete('/:id/comments/:commentId', protect, deleteComment);

module.exports = router;
