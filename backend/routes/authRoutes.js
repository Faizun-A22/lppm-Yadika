const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Register
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Lupa Password - Kirim instruksi & OTP ke email
router.post('/forgot-password', authController.forgotPassword);

// Lupa Password - Verifikasi kode OTP atau token
router.post('/verify-reset-code', authController.verifyResetCode);

// Lupa Password - Eksekusi pembaruan sandi
router.post('/reset-password', authController.resetPassword);

// Verify token
router.post('/verify', authenticateToken, (req, res) => {
  res.status(200).json({ 
    message: 'Token valid',
    data: { user: req.user }
  });
});

module.exports = router;