const cron = require('node-cron');
const pool = require('../config/db');
const { stopAuctionTick } = require('../sockets');

// Start scheduled auctions → 'live' every 10 seconds
cron.schedule('*/10 * * * * *', async () => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM auctions WHERE status='scheduled' AND start_time <= NOW()"
    );
    for (const row of rows) {
      await pool.query("UPDATE auctions SET status='live' WHERE id=$1", [row.id]);
      console.log(`🟢 Auction started: ${row.id}`);
    }
  } catch (err) {
    console.error('Start auction job error:', err.message);
  }
});

// End live auctions every 5 seconds
cron.schedule('*/5 * * * * *', async () => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM auctions WHERE status='live' AND end_time <= NOW()"
    );
    for (const row of rows) {
      const auctionService = require('../services/auctionService');
      const notificationService = require('../services/notificationService');
      const { getIO } = require('../sockets');

      const result = await auctionService.endAuction(row.id);
      if (!result) continue;

      if (typeof stopAuctionTick === 'function') {
        stopAuctionTick(row.id);
      }
      console.log(`🔴 Auction ended: ${row.id}`);

      try {
        const io = getIO();
        const payload = {
          winner_id: result.winner?.bidder_id || null,
          final_price: result.winner?.amount || null,
          item_title: result.auction.item_title,
        };

        // Primary legacy room currently used by connected clients.
        io.to(`auction_${row.id}`).emit('auction_ended', payload);
        // Compatibility emit for alternate room naming.
        io.to(`auction:${row.id}`).emit('auction_ended', payload);
      } catch {}

      // Notify winner
      if (result.winner) {
        await notificationService.createNotification(result.winner.bidder_id, 'won', {
          auction_id: row.id,
          final_price: result.winner.amount,
          order_id: result.order?.id,
        });
      }
    }
  } catch (err) {
    console.error('End auction job error:', err.message);
  }
});

// Notify watchers 5 minutes before auction ends
cron.schedule('0 * * * * *', async () => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, i.title FROM auctions a
       JOIN items i ON i.id=a.item_id
       WHERE a.status='live' AND a.end_time BETWEEN NOW() AND NOW() + INTERVAL '5 minutes'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n WHERE n.payload->>'auction_id'=a.id::text AND n.type='auction_ending'
         AND n.created_at > NOW() - INTERVAL '10 minutes'
       )`
    );
    const notificationService = require('../services/notificationService');
    for (const auction of rows) {
      const { rows: watchers } = await pool.query(
        'SELECT user_id FROM watchlist WHERE auction_id=$1', [auction.id]
      );
      for (const w of watchers) {
        await notificationService.createNotification(w.user_id, 'auction_ending', {
          auction_id: auction.id,
          item_title: auction.title,
        });
      }
    }
  } catch (err) {
    console.error('Ending notification job error:', err.message);
  }
});

// Daily affinity decay at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    await pool.query(
      'UPDATE user_category_interests SET affinity_score = affinity_score * 0.95, last_updated = NOW()'
    );
    console.log('📉 Affinity decay applied');
  } catch (err) {
    console.error('Affinity decay error:', err.message);
  }
});

console.log('⏰ Cron jobs initialized');
