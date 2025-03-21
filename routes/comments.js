
const express = require('express');
const { check } = require('express-validator');
const { 
  getComment, 
  updateComment, 
  deleteComment, 
  voteComment,
  getCommentReplies
} = require('../controllers/comments');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/:id')
  .get(getComment)
  .put([
    protect,
    check('content', 'Content is required').not().isEmpty()
  ], updateComment)
  .delete(protect, deleteComment);

router.route('/:id/vote')
  .post(protect, voteComment);

router.route('/:id/replies')
  .get(getCommentReplies);

module.exports = router;
