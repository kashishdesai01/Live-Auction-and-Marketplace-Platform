class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
    this.isOperational = true;
  }
}

function errorHandler(err, req, res, next) {
  // Operational errors: known issues we throw intentionally
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message }
    });
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.details }
    });
  }

  // PostgreSQL errors
  if (err.code === '23505') {
    return res.status(409).json({
      error: { code: 'DUPLICATE', message: 'Resource already exists' }
    });
  }
  if (err.code === '23503') {
    return res.status(400).json({
      error: { code: 'FOREIGN_KEY', message: 'Referenced resource not found' }
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid token' }
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: { code: 'TOKEN_EXPIRED', message: 'Token expired' }
    });
  }

  // Unknown errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  });
}

module.exports = { AppError, errorHandler };
