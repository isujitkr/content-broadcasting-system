const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  registerValidator,
  loginValidator,
} = require('../middlewares/validation.middleware');


router.post('/register', authLimiter, registerValidator, AuthController.register);

router.post('/login', authLimiter, loginValidator, AuthController.login);

router.post('/logout', authenticate, AuthController.logout);

router.get('/me', authenticate, AuthController.getProfile);

module.exports = router;