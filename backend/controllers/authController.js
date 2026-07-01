// controllers/authController.js

const authService = require('../services/authService');

class AuthController {
  constructor() {
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
  }

  async register(req, res) {
    try {
      // Force isDosen and isAdmin to be false for public registration
      const publicUserData = {
        ...req.body,
        isDosen: false,
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
}

module.exports = new AuthController();