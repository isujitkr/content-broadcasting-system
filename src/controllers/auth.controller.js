const AuthService = require('../services/auth.service');
const {
  successResponse,
  createdResponse,
  errorResponse,
} = require('../utils/response');

class AuthController {
 
  static async register(req, res, next) {
    try {
      const { name, email, password, role } = req.body;
      const result = await AuthService.register(
        name,email,password,role
      );

      return createdResponse(res, result, 'Registration successful');
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password, res);

      return successResponse(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      await AuthService.logout(res);
      return successResponse(res, null, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const user = await AuthService.getProfile(req.user.id);
      return successResponse(res, { user }, 'Profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;