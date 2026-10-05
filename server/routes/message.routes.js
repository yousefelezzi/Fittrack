const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const {
  getConversations, getUnreadCount, openConversation, getMessages, sendMessage, markRead,
  createGroup, renameGroup, addMembers, leaveGroup,
} = require('../controllers/message.controller');

router.get('/conversations', protect, getConversations);
router.get('/unread', protect, getUnreadCount);
router.post('/conversations', protect, [body('userId').isMongoId().withMessage('Invalid user')], validate, openConversation);
router.get('/conversations/:id', protect, getMessages);
router.post(
  '/conversations/:id',
  protect,
  [
    body('text').optional().isString().isLength({ max: 2000 }).withMessage('Message too long (max 2000 characters)'),
    body('workoutSession').optional({ nullable: true }).isMongoId().withMessage('Invalid workout'),
  ],
  validate,
  sendMessage
);
router.post('/conversations/:id/read', protect, markRead);

// Group chats
const groupName = body('name').isString().trim().isLength({ min: 1, max: 60 }).withMessage('Group name must be 1–60 characters');
const userIds = body('userIds').isArray({ min: 1, max: 49 }).withMessage('Pick who to add');
router.post('/groups', protect, [groupName, userIds, body('userIds.*').isMongoId().withMessage('Invalid user')], validate, createGroup);
router.put('/conversations/:id', protect, [groupName], validate, renameGroup);
router.post('/conversations/:id/members', protect, [userIds, body('userIds.*').isMongoId().withMessage('Invalid user')], validate, addMembers);
router.post('/conversations/:id/leave', protect, leaveGroup);

module.exports = router;
