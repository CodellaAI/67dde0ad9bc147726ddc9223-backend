
const express = require('express');
const { check } = require('express-validator');
const { 
  getPosts, 
  getPost, 
  createPost, 
  updatePost, 
  deletePost, 
  votePost, 
  getPostComments, 
  addComment 
} = require('../controllers/posts');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(getPosts)
  .post([
    protect,
    check('title', 'Title is required').not().isEmpty(),
    check('community', 'Community is required').not().isEmpty()
  ], createPost);

router.route('/:id')
  .get(getPost)
  .put(protect, updatePost)
  .delete(protect, deletePost);

router.route('/:id/vote')
  .post(protect, votePost);

router.route('/:id/comments')
  .get(getPostComments)
  .post([
    protect,
    check('content', 'Content is required').not().isEmpty()
  ], addComment);

module.exports = router;
