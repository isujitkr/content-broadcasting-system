const UserModel = require('../models/user.model');
const { successResponse, notFoundResponse } = require('../utils/response');

class UserController {

  static async getAllTeachers(req, res, next) {
    try {
      const teachers = await UserModel.findAllTeachers();
      return successResponse(res, { teachers }, 'Teachers fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.role === 'teacher' && req.user.id !== id) {
        return notFoundResponse(res, 'User not found');
      }

      const user = await UserModel.findById(id);
      if (!user) return notFoundResponse(res, 'User not found');

      return successResponse(res, { user }, 'User fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;