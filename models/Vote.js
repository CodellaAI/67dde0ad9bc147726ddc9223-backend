
const mongoose = require('mongoose');

const VoteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The item being voted on (post or comment)
  item: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'itemModel'
  },
  // The type of item (Post or Comment)
  itemModel: {
    type: String,
    required: true,
    enum: ['Post', 'Comment']
  },
  // 1 for upvote, -1 for downvote
  value: {
    type: Number,
    required: true,
    enum: [1, -1]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can only vote once per item
VoteSchema.index({ user: 1, item: 1 }, { unique: true });

module.exports = mongoose.model('Vote', VoteSchema);
