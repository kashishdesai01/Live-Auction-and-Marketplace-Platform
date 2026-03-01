const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { validate, validateEmail, validatePassword, validateDisplayName } = require('../middleware/validate');
const { body } = require('express-validator');

// POST /api/auth/register/buyer
router.post('/register/buyer', [
  validateEmail, validatePassword, validateDisplayName,
  validate,
], async (req, res, next) => {
  try {
    const { email, password, display_name } = req.body;
    const result = await authService.register(email, password, display_name, 'buyer');
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, access_token: result.accessToken });
  } catch (err) { next(err); }
});

// POST /api/auth/register/seller
router.post('/register/seller', [
  validateEmail, validatePassword, validateDisplayName,
  validate,
], async (req, res, next) => {
  try {
    const { email, password, display_name } = req.body;
    const result = await authService.register(email, password, display_name, 'seller');
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, access_token: result.accessToken });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', [
  validateEmail,
  body('password').notEmpty(),
  validate,
], async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, access_token: result.accessToken });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token' } });
    }
    const tokens = await authService.refreshAccessToken(refreshToken);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ access_token: tokens.accessToken });
  } catch (err) { next(err); }
});

// POST /api/auth/switch-role
router.post('/switch-role', authenticate, [
  body('role').isIn(['buyer', 'seller']).withMessage('Role must be buyer or seller'),
  validate,
], async (req, res, next) => {
  try {
    const { role } = req.body;
    const result = await authService.switchRole(req.user.sub, role);
    res.json({ access_token: result.accessToken });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.decode(refreshToken);
        await authService.logout(req.user.sub, decoded?.jti);
      } catch {}
    }
    res.clearCookie('refresh_token');
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.sub);
    res.json({ user });
  } catch (err) { next(err); }
});

function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

module.exports = router;
