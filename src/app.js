const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes/index');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');
const { generalLimiter } = require('./middlewares/rateLimiter.middleware');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', generalLimiter);

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Content Broadcasting System',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;