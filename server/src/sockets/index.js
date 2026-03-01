const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');

let io;
// Track per-auction tick intervals
const auctionTicks = new Map();

function initSocket(server) {
  const pubClient = new Redis(process.env.REDIS_URL);
  const subClient = pubClient.duplicate();

  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.adapter(createAdapter(pubClient, subClient));

  // Authenticate socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        socket.user = null;
      }
    } else {
      socket.user = null;
    }
    next();
  });

  io.on('connection', (socket) => {
    const auctionHandler = require('./auctionHandler');
    auctionHandler(io, socket);

    // Personal notification room
    if (socket.user) {
      socket.join(`user:${socket.user.sub}`);
    }

    socket.on('error', (err) => console.error('Socket error:', err));
  });

  console.log('✅ Socket.IO initialized');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

function startAuctionTick(auctionId, endTime) {
  if (auctionTicks.has(auctionId)) return;

  const interval = setInterval(async () => {
    const now = Date.now();
    const timeRemaining = new Date(endTime).getTime() - now;

    if (timeRemaining <= 0) {
      stopAuctionTick(auctionId);
      return;
    }

    // Get current price from DB
    const pool = require('../config/db');
    const { rows } = await pool.query(
      'SELECT current_price, viewer_count FROM auctions WHERE id=$1',
      [auctionId]
    );
    if (rows[0]) {
      io.to(`auction:${auctionId}`).emit('auction_tick', {
        time_remaining_ms: timeRemaining,
        current_price: parseFloat(rows[0].current_price),
        viewer_count: rows[0].viewer_count,
      });
    }
  }, 1000);

  auctionTicks.set(auctionId, interval);
}

function stopAuctionTick(auctionId) {
  const interval = auctionTicks.get(auctionId);
  if (interval) {
    clearInterval(interval);
    auctionTicks.delete(auctionId);
  }
}

module.exports = { initSocket, getIO, startAuctionTick, stopAuctionTick };
