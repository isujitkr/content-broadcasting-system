const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const contentRoutes = require('./content.routes');
const userRoutes = require('./user.routes');

router.use('/auth', authRoutes);
router.use('/content', contentRoutes);
router.use('/users', userRoutes);

module.exports = router;