
const express = require('express');
const { check } = require('express-validator');
const { register, login, getMe, logout } = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', [
  check('username', 'Username is required').not().isEmpty(),
  check('username', 'Username must be at least 3 characters').isLength({ min: 3 }),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
], register);

router.post('/login', [
  check('username', 'Username is required').not().isEmpty(),
  check('password', 'Password is required').exists()
], login);

router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

module.exports = router;
