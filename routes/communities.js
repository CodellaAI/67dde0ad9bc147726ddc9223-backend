
const express = require('express');
const { check } = require('express-validator');
const { 
  getCommunities, 
  getTopCommunities,
  getCommunity, 
  createCommunity, 
  updateCommunity, 
  joinCommunity, 
  leaveCommunity,
  getCommunityPosts
} = require('../controllers/communities');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(getCommunities)
  .post([
    protect,
    check('name', 'Name is required').not().isEmpty(),
    check('name', 'Name must be between 3 and 21 characters').isLength({ min: 3, max: 21 }),
    check('name', 'Name can only contain letters, numbers, and underscores').matches(/^[a-zA-Z0-9_]+$/),
    check('description', 'Description is required').not().isEmpty()
  ], createCommunity);

router.get('/top', getTopCommunities);

router.route('/:name')
  .get(getCommunity)
  .put(protect, updateCommunity);

router.post('/:name/join', protect, joinCommunity);
router.post('/:name/leave', protect, leaveCommunity);
router.get('/:name/posts', getCommunityPosts);

module.exports = router;
