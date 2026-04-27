const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 'File size exceeds the 10MB limit', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return errorResponse(res, 'Unexpected field in file upload', 400);
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return errorResponse(res, err.message, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token has expired', 401);
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return errorResponse(res, 'A record with this data already exists', 409);
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return errorResponse(res, 'Referenced resource does not exist', 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return errorResponse(res, message, statusCode);
};

const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { errorHandler, notFoundHandler };