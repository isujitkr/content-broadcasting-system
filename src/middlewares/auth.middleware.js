const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/database');
const { unauthorizedResponse, forbiddenResponse } = require('../utils/response');

const extractToken = (req) => {
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};


const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return unauthorizedResponse(res, 'Authentication required. Please log in.');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return unauthorizedResponse(res, 'Access token has expired');
      }
      return unauthorizedResponse(res, 'Invalid access token');
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return unauthorizedResponse(res, 'User no longer exists');
    }

    const user = rows[0];

    if (!user.is_active) {
      return unauthorizedResponse(res, 'Account has been deactivated');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return unauthorizedResponse(res, 'Authentication failed');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorizedResponse(res, 'Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      return forbiddenResponse(
        res,
        `Access denied. Required role(s): ${roles.join(', ')}`
      );
    }

    next();
  };
};

const principalOnly = authorize('principal');

const teacherOnly = authorize('teacher');

const staffOnly = authorize('principal', 'teacher');

module.exports = { authenticate, authorize, principalOnly, teacherOnly, staffOnly };