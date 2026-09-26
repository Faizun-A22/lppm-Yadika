// controllers/authController.js

const authService = require('../services/authService');

class AuthController {
  constructor() {
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.verifyResetCode = this.verifyResetCode.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
  }

  async register(req, res) {
    try {
      // Force isAdmin to be false for public registration, but allow isDosen
      const publicUserData = {
        ...req.body,
        isAdmin: false
      };
      const result = await authService.register(publicUserData);
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Register error:', error.message);
      res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password, isAdmin, isDosen } = req.body;
      const result = await authService.login(email, password, isAdmin, isDosen);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Login error:', error.message);
      res.status(401).json({ 
        success: false,
        message: error.message 
      });
    }
  }

  /**
   * Request reset password via email
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const clientOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : '');
      const result = await authService.forgotPassword(email, clientOrigin);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('ForgotPassword error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Verifikasi kode OTP atau token reset
   */
  async verifyResetCode(req, res) {
    try {
      const { email, code } = req.body;
      const result = await authService.verifyResetCode(email, code);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('VerifyResetCode error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Eksekusi ganti kata sandi baru
   */
  async resetPassword(req, res) {
    try {
      const { email, token, otp, newPassword, confirmPassword } = req.body;
      const result = await authService.resetPassword({
        email,
        token,
        otp,
        newPassword,
        confirmPassword
      });
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('ResetPassword error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AuthController();