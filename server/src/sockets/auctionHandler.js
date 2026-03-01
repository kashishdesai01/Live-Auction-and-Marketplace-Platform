const auctionService = require('../services/auctionService');
const notificationService = require('../services/notificationService');
const { startAuctionTick, stopAuctionTick } = require('./index');

module.exports = function auctionHandler(io, socket) {
  // join_auction
  socket.on('join_auction', async ({ auction_id }) => {
    if (!auction_id) return;
    socket.join(`auction:${auction_id}`);

    // Increment viewer count
    const pool = require('../config/db');
    await pool.query(
      'UPDATE auctions SET viewer_count = viewer_count + 1 WHERE id=$1 AND status=$2',
      [auction_id, 'live']
    );
    const { rows } = await pool.query('SELECT viewer_count FROM auctions WHERE id=$1', [auction_id]);
    if (rows[0]) {
      io.to(`auction:${auction_id}`).emit('viewer_update', { count: rows[0].viewer_count });

      // Start tick if not running
      const { rows: aRows } = await pool.query('SELECT end_time FROM auctions WHERE id=$1 AND status=$2', [auction_id, 'live']);
      if (aRows[0]) startAuctionTick(auction_id, aRows[0].end_time);
    }
  });

  // leave_auction
  socket.on('leave_auction', async ({ auction_id }) => {
    if (!auction_id) return;
    socket.leave(`auction:${auction_id}`);

    const pool = require('../config/db');
    await pool.query(
      'UPDATE auctions SET viewer_count = GREATEST(viewer_count - 1, 0) WHERE id=$1',
      [auction_id]
    );
    const { rows } = await pool.query('SELECT viewer_count FROM auctions WHERE id=$1', [auction_id]);
    if (rows[0]) {
      io.to(`auction:${auction_id}`).emit('viewer_update', { count: rows[0].viewer_count });
    }

    // Stop tick if room is empty
    const roomSize = io.sockets.adapter.rooms.get(`auction:${auction_id}`)?.size || 0;
    if (roomSize === 0) stopAuctionTick(auction_id);
  });

  // place_bid
  socket.on('place_bid', async ({ auction_id, amount, idempotency_key }) => {
    if (!socket.user) {
      return socket.emit('bid_rejected', { reason: 'unauthenticated' });
    }

    const bidderId = socket.user.sub;

    try {
      const result = await auctionService.placeBid(auction_id, bidderId, amount, idempotency_key);

      if (!result.accepted) {
        return socket.emit('bid_rejected', { reason: result.reason });
      }

      if (result.duplicate) {
        return socket.emit('bid_accepted', { duplicate: true, new_price: result.newPrice });
      }

      // Broadcast to auction room
      io.to(`auction:${auction_id}`).emit('bid_accepted', {
        bidder_name: socket.user.display_name,
        amount: result.newPrice,
        new_price: result.newPrice,
        timestamp: new Date().toISOString(),
      });

      // Notify outbid user
      if (result.outbidUserId) {
        await notificationService.createNotification(result.outbidUserId, 'outbid', {
          auction_id,
          your_max_bid: amount,
          new_high_bid: result.newPrice,
        });
        io.to(`user:${result.outbidUserId}`).emit('outbid_alert', {
          your_max_bid: amount,
          new_high_bid: result.newPrice,
          auction_id,
        });
      }
    } catch (err) {
      console.error('Bid error:', err);
      socket.emit('bid_rejected', { reason: 'server_error' });
    }
  });

  // Handle disconnect — remove from all auction rooms
  socket.on('disconnect', async () => {
    const pool = require('../config/db');
    const rooms = [...socket.rooms].filter(r => r.startsWith('auction:'));
    for (const room of rooms) {
      const auctionId = room.replace('auction:', '');
      await pool.query(
        'UPDATE auctions SET viewer_count = GREATEST(viewer_count - 1, 0) WHERE id=$1',
        [auctionId]
      ).catch(() => {});
    }
  });
};
