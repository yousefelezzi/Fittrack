const mongoose = require('mongoose');

/** Most people in one group chat, you included. */
const MAX_GROUP_SIZE = 50;

/**
 * A chat: one-to-one (exactly two people) or a named group. `lastMessage` and
 * `updatedAt` let the inbox be listed newest-first without reading every message.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator(v) { return this.isGroup ? v.length <= MAX_GROUP_SIZE : v.length === 2; },
        message: 'Too many people for one conversation',
      },
    },
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true, maxlength: 60, default: '' }, // groups only
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      sentAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.statics.MAX_GROUP_SIZE = MAX_GROUP_SIZE;

module.exports = mongoose.model('Conversation', conversationSchema);
