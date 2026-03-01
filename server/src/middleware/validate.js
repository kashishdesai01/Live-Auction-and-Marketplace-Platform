const { validationResult, body } = require('express-validator');
const { AppError } = require('./error');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.type = 'validation';
    err.details = errors.array();
    return next(err);
  }
  next();
}

const validateEmail = body('email').isEmail().normalizeEmail().withMessage('Valid email required');
const validatePassword = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/).withMessage('Password must contain uppercase letter')
  .matches(/[0-9]/).withMessage('Password must contain a number');
const validateDisplayName = body('display_name').trim().isLength({ min: 2, max: 100 }).withMessage('Display name 2-100 chars');

module.exports = { validate, validateEmail, validatePassword, validateDisplayName };
