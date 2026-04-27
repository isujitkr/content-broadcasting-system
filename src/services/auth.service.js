const UserModel = require('../models/user.model');
const { generateToken } = require('../utils/jwt');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,    
};
const attachTokenCookie = (res, token) => {
  res.cookie('accessToken', token, COOKIE_OPTIONS);
};

const clearTokenCookie = (res) => {
  res.clearCookie('accessToken');
};

class AuthService {

  static async register(name, email, password, role) {
    const normalizeEmail = email.toLowerCase();
    const exists = await UserModel.emailExists(normalizeEmail);
    if (exists) {
      const error = new Error('User already registered');
      error.statusCode = 409;
      throw error;
    }

    const user = await UserModel.create({ name, email : normalizeEmail, password, role });
    return { user };
  }


  static async login(email, password, res) {
    const normalizeEmail = email.toLowerCase();
    const user = await UserModel.findByEmail(normalizeEmail);

    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await UserModel.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    await UserModel.updateLastLogin(user.id);

    const token = generateToken({ id: user.id, role: user.role });
    attachTokenCookie(res, token);

    const safeUser = UserModel.sanitize(user);

    return { user: safeUser };
  }

  static async logout(res) {
    clearTokenCookie(res);
    return { message: 'Logged out successfully.' };
  }

  static async getProfile(userId) {
    const user = await UserModel.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }
}

module.exports = AuthService;