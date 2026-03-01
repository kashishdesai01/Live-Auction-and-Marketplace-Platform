const pool = require('../config/db');
const { getIO } = require('../sockets');

async function createNotification(userId, type, payload) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, type, JSON.stringify(payload)]
  );
  const notification = rows[0];

  // Push in real-time to user's personal socket room
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('notification', notification);
  } catch {}

  return notification;
}

async function getNotifications(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE user_id=$1
     ORDER BY is_read ASC, created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

async function getUnreadCount(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE',
    [userId]
  );
  return parseInt(rows[0].count);
}

async function markRead(userId, notificationId) {
  await pool.query(
    'UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2',
    [notificationId, userId]
  );
}

async function markAllRead(userId) {
  await pool.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [userId]);
}

module.exports = { createNotification, getNotifications, getUnreadCount, markRead, markAllRead };
