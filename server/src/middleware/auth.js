const jwt = require('jsonwebtoken');
const { AppError } = require('./error');

const ACCESS_SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No token provided', 401, 'NO_TOKEN'));
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, ACCESS_SECRET);
    next();
  } catch (err) {
    next(err);
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, ACCESS_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    if (!req.user.roles.includes(role)) {
      return next(new AppError(`Requires ${role} role`, 403, 'FORBIDDEN'));
    }
    next();
  };
}

function requireActiveRole(role) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    if (req.user.active_role !== role) {
      return next(new AppError(`Switch to ${role} role first`, 403, 'WRONG_ACTIVE_ROLE'));
    }
    next();
  };
}

module.exports = { authenticate, optionalAuth, requireRole, requireActiveRole };
