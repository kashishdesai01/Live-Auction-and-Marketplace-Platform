const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const redis = require('../config/redis');
const { AppError } = require('../middleware/error');

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      active_role: user.active_role,
      display_name: user.display_name,
      has_payment_method: !!user.stripe_customer_id || !!user.has_payment_method,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generateRefreshToken(userId, tokenId) {
  return jwt.sign({ sub: userId, jti: tokenId }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_SECONDS,
  });
}

async function storeRefreshToken(userId, tokenId) {
  await redis.setex(`refresh:${userId}:${tokenId}`, REFRESH_EXPIRES_SECONDS, '1');
}

async function revokeRefreshToken(userId, tokenId) {
  await redis.del(`refresh:${userId}:${tokenId}`);
}

async function issueTokens(user) {
  const tokenId = uuidv4();
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id, tokenId);
  await storeRefreshToken(user.id, tokenId);
  return { accessToken, refreshToken, tokenId };
}

async function register(email, password, displayName, role) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, display_name, roles, active_role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [email, passwordHash, displayName, [role], role]
    );
    const user = rows[0];

    if (role === 'buyer') {
      await client.query(
        'INSERT INTO buyer_profiles (user_id) VALUES ($1)', [user.id]
      );
    } else if (role === 'seller') {
      await client.query(
        'INSERT INTO seller_profiles (user_id, storefront_name) VALUES ($1, $2)',
        [user.id, displayName]
      );
    }

    await client.query('COMMIT');
    const tokens = await issueTokens(user);
    return { user: sanitizeUser(user), ...tokens };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function login(email, password) {
  const { rows } = await pool.query(
    `SELECT u.*, bp.stripe_customer_id 
     FROM users u 
     LEFT JOIN buyer_profiles bp ON u.id = bp.user_id 
     WHERE email = $1`, 
    [email]
  );
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  if (user.is_suspended) {
    throw new AppError('Account suspended', 403, 'SUSPENDED');
  }

  user.has_payment_method = !!user.stripe_customer_id;
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}

async function refreshAccessToken(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  const exists = await redis.get(`refresh:${decoded.sub}:${decoded.jti}`);
  if (!exists) {
    throw new AppError('Refresh token revoked', 401, 'TOKEN_REVOKED');
  }

  // Rotate: revoke old, issue new
  await revokeRefreshToken(decoded.sub, decoded.jti);

  const { rows } = await pool.query(
    `SELECT u.*, bp.stripe_customer_id 
     FROM users u 
     LEFT JOIN buyer_profiles bp ON u.id = bp.user_id 
     WHERE u.id = $1`, 
    [decoded.sub]
  );
  if (!rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND');

  const user = rows[0];
  user.has_payment_method = !!user.stripe_customer_id;

  const tokens = await issueTokens(user);
  return tokens;
}

async function switchRole(userId, newRole) {
  const { rows } = await pool.query(
    `SELECT u.*, bp.stripe_customer_id 
     FROM users u 
     LEFT JOIN buyer_profiles bp ON u.id = bp.user_id 
     WHERE u.id = $1`, 
    [userId]
  );
  const user = rows[0];
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  if (!user.roles.includes(newRole)) {
    throw new AppError('You do not have this role', 403, 'ROLE_NOT_FOUND');
  }

  await pool.query('UPDATE users SET active_role = $1 WHERE id = $2', [newRole, userId]);
  user.active_role = newRole;
  user.has_payment_method = !!user.stripe_customer_id;

  const accessToken = generateAccessToken(user);
  return { accessToken };
}

async function logout(userId, tokenId) {
  if (userId && tokenId) {
    await revokeRefreshToken(userId, tokenId);
  }
}

async function getMe(userId) {
  const { rows } = await pool.query(
    `SELECT u.*, bp.onboarding_completed, bp.total_won, bp.total_spent, bp.stripe_customer_id,
            sp.storefront_name, sp.is_verified_seller, sp.avg_rating, sp.total_sales
     FROM users u
     LEFT JOIN buyer_profiles bp ON bp.user_id = u.id AND 'buyer' = ANY(u.roles)
     LEFT JOIN seller_profiles sp ON sp.user_id = u.id AND 'seller' = ANY(u.roles)
     WHERE u.id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND');
  
  const user = rows[0];
  user.has_payment_method = !!user.stripe_customer_id;
  return sanitizeUser(user);
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = { register, login, refreshAccessToken, switchRole, logout, getMe };
