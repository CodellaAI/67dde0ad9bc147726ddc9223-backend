
const express = require('express');
const { check } = require('express-validator');
const { 
  getUserProfile, 
  updateProfile, 
  getUserPosts, 
  getUserComments
} = require('../controllers/users');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/:username', getUserProfile);
router.put('/profile', [
  protect,
  check('bio', 'Bio cannot be more than 500 characters').optional().isLength({ max: 500 })
], updateProfile);
router.get('/:username/posts', getUserPosts);
router.get('/:username/comments', getUserComments);

module.exports = router;
