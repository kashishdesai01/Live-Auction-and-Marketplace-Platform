const socketIo = require('socket.io');

let io;

module.exports = {
  // Initialize the Socket.io server
  initSocket: (server) => {
    io = socketIo(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    console.log('🔌 WebSocket server initialized');

    io.on('connection', (socket) => {
      // console.log(`[Socket] Client connected: ${socket.id}`);

      // Client joins a specific auction room to listen for bids
      socket.on('join_auction', (auctionId) => {
        if (auctionId) {
          socket.join(`auction_${auctionId}`);
          // console.log(`[Socket] Client ${socket.id} joined room auction_${auctionId}`);
        }
      });

      // Client leaves the room when they navigate away
      socket.on('leave_auction', (auctionId) => {
        if (auctionId) {
          socket.leave(`auction_${auctionId}`);
          // console.log(`[Socket] Client ${socket.id} left room auction_${auctionId}`);
        }
      });

      socket.on('disconnect', () => {
        // console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });

    return io;
  },

  // Get the initialized Socket.io instance to emit events from anywhere in the codebase
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io has not been initialized!');
    }
    return io;
  },

  // Compatibility helpers for cron job imports.
  startAuctionTick: () => {},

  stopAuctionTick: () => {},
};
