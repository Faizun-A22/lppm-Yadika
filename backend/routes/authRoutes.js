const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Register
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Verify token
router.post('/verify', authenticateToken, (req, res) => {
  res.status(200).json({ 
    message: 'Token valid',
    data: { user: req.user }
  });
});

module.exports = router;