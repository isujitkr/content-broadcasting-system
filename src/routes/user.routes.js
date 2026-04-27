const express = require('express');
const router = express.Router();

const UserController = require('../controllers/user.controller');
const { authenticate, principalOnly, staffOnly } = require('../middlewares/auth.middleware');

router.get('/teachers', authenticate, principalOnly, UserController.getAllTeachers);

router.get('/:id', authenticate, staffOnly, UserController.getUserById);

module.exports = router;