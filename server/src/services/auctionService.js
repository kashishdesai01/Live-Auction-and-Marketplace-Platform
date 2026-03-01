const pool = require('../config/db');
const redis = require('../config/redis');
const { AppError } = require('../middleware/error');

async function createAuction(sellerId, { item_id, start_time, end_time, bid_increment }) {
  // Verify item ownership and availability
  const { rows: items } = await pool.query(
    "SELECT * FROM items WHERE id=$1 AND seller_id=$2 AND status='draft'",
    [item_id, sellerId]
  );
  if (!items[0]) throw new AppError('Item not found or not available', 404, 'NOT_FOUND');

  const start = new Date(start_time);
  const end = new Date(end_time);
  if (end <= start) throw new AppError('end_time must be after start_time', 400, 'INVALID_TIME');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO auctions (item_id, start_time, end_time, current_price, bid_increment, status)
       VALUES ($1,$2,$3,$4,$5,'scheduled') RETURNING *`,
      [item_id, start, end, items[0].starting_price, bid_increment || 1.00]
    );
    // Set item active
    await client.query("UPDATE items SET status='active' WHERE id=$1", [item_id]);
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateAuction(sellerId, auctionId, data) {
  const { rows } = await pool.query(
    `SELECT a.*, i.seller_id FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1`,
    [auctionId]
  );
  const auction = rows[0];
  if (!auction) throw new AppError('Auction not found', 404, 'NOT_FOUND');
  if (auction.seller_id !== sellerId) throw new AppError('Not your auction', 403, 'FORBIDDEN');
  if (auction.status !== 'scheduled') throw new AppError('Can only edit scheduled auctions', 400, 'INVALID_STATE');

  const { start_time, end_time, bid_increment } = data;
  const { rows: updated } = await pool.query(
    `UPDATE auctions SET
       start_time = COALESCE($1, start_time),
       end_time = COALESCE($2, end_time),
       bid_increment = COALESCE($3, bid_increment)
     WHERE id=$4 RETURNING *`,
    [start_time, end_time, bid_increment, auctionId]
  );
  return updated[0];
}

async function placeBid(auctionId, bidderId, amount, idempotencyKey) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Pessimistic lock on auction row
    const { rows } = await client.query(
      'SELECT a.*, i.seller_id FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1 FOR UPDATE',
      [auctionId]
    );
    const auction = rows[0];

    if (!auction) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'ended' };
    }
    if (auction.status !== 'live') {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'ended' };
    }
    if (auction.seller_id === bidderId) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'own_bid' };
    }
    const minBid = parseFloat(auction.current_price) + parseFloat(auction.bid_increment);
    if (parseFloat(amount) < minBid) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'too_low' };
    }

    // Get previous high bidder before updating
    const { rows: prevBids } = await client.query(
      "SELECT bidder_id FROM bids WHERE auction_id=$1 AND status='active' ORDER BY amount DESC LIMIT 1",
      [auctionId]
    );
    const prevHighBidder = prevBids[0]?.bidder_id;

    // Update auction price
    await client.query(
      'UPDATE auctions SET current_price=$1, version=version+1 WHERE id=$2',
      [amount, auctionId]
    );

    // Mark previous highest bid as outbid
    await client.query(
      "UPDATE bids SET status='outbid' WHERE auction_id=$1 AND status='active'",
      [auctionId]
    );

    // Insert new bid (idempotent)
    const { rows: bidRows } = await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, idempotency_key, status)
       VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [auctionId, bidderId, amount, idempotencyKey]
    );

    // Fetch full bidder details to send over the websocket so the UI can draw the new row
    let bidderName = 'Anonymous';
    if (bidRows[0]) {
       const uRes = await client.query('SELECT display_name FROM users WHERE id=$1', [bidderId]);
       bidderName = uRes.rows[0]?.display_name || bidderName;
    }

    await client.query('COMMIT');

    if (!bidRows[0]) {
      // Duplicate idempotency key — treat as accepted
      return { accepted: true, duplicate: true, newPrice: auction.current_price };
    }

    // Track bid velocity in Redis (rolling 5-min window)
    const velocityKey = `bid_velocity:${auctionId}`;
    await redis.lpush(velocityKey, Date.now());
    await redis.ltrim(velocityKey, 0, 499); // keep last 500 bids max
    await redis.expire(velocityKey, 3600);

    // ==========================================
    // EMIT REAL-TIME WEBSOCKET EVENT
    // ==========================================
    try {
      const io = require('../sockets').getIO();
      io.to(`auction_${auctionId}`).emit('bid_placed', {
        auctionId,
        newPrice: parseFloat(amount),
        bid: {
          ...bidRows[0],
          bidder_name: bidderName // Append for the frontend table
        }
      });
    } catch (socketErr) {
        console.error('Socket Emission Failed:', socketErr);
    }

    return {
      accepted: true,
      newPrice: parseFloat(amount),
      bid: bidRows[0],
      outbidUserId: prevHighBidder && prevHighBidder !== bidderId ? prevHighBidder : null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function endAuction(auctionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      "SELECT * FROM auctions WHERE id=$1 AND status='live' FOR UPDATE",
      [auctionId]
    );
    const auction = rows[0];
    if (!auction) { await client.query('ROLLBACK'); return null; }

    // Find winner (highest active bid)
    const { rows: bids } = await client.query(
      "SELECT * FROM bids WHERE auction_id=$1 ORDER BY amount DESC LIMIT 1",
      [auctionId]
    );
    const winner = bids[0];

    await client.query(
      `UPDATE auctions SET status='ended', winner_id=$1, final_price=$2 WHERE id=$3`,
      [winner?.bidder_id || null, winner?.amount || null, auctionId]
    );

    // Mark winning bid
    if (winner) {
      await client.query("UPDATE bids SET status='won' WHERE id=$1", [winner.id]);
    }

    // Update item status
    await client.query(
      `UPDATE items SET status=$1 WHERE id=$2`,
      [winner ? 'sold' : 'ended', auction.item_id]
    );

    // Create order if winner
    let order = null;
    if (winner) {
      const { rows: itemRows } = await client.query('SELECT seller_id FROM items WHERE id=$1', [auction.item_id]);
      const sellerId = itemRows[0].seller_id;
      
      const { rows: buyerProfile } = await client.query('SELECT stripe_customer_id FROM buyer_profiles WHERE user_id=$1', [winner.bidder_id]);
      const { rows: sellerProfile } = await client.query('SELECT stripe_account_id FROM seller_profiles WHERE user_id=$1', [sellerId]);
      
      const buyerCustomerId = buyerProfile[0]?.stripe_customer_id;
      const sellerAccountId = sellerProfile[0]?.stripe_account_id;

      let paymentIntentId = null;

      if (buyerCustomerId && sellerAccountId) {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
          
          // Get the default vaulted card
          const pms = await stripe.paymentMethods.list({ customer: buyerCustomerId, type: 'card' });
          const paymentMethod = pms.data[0]?.id;

          if (paymentMethod) {
             const finalPriceCents = Math.round(winner.amount * 100);
             const platformFeeCents = Math.round(finalPriceCents * 0.05); // 5% platform fee

             const pi = await stripe.paymentIntents.create({
               amount: finalPriceCents,
               currency: 'usd',
               customer: buyerCustomerId,
               payment_method: paymentMethod,
               off_session: true,
               confirm: true,
               transfer_data: {
                 destination: sellerAccountId,
               },
               application_fee_amount: platformFeeCents,
               metadata: {
                 auction_id: auctionId,
                 item_id: auction.item_id
               }
             });
             paymentIntentId = pi.id;
          }
        } catch (paymentErr) {
          console.error(`Failed to process Stripe off_session payment for auction ${auctionId}:`, paymentErr);
          // We still create the order, but we can mark it as payment_failed in the webhook later
        }
      }

      const { rows: orderRows } = await client.query(
        `INSERT INTO orders (auction_id, buyer_id, seller_id, amount, status)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [auctionId, winner.bidder_id, sellerId, winner.amount, paymentIntentId ? 'paid' : 'pending']
      );
      order = orderRows[0];
    }

    await client.query('COMMIT');
    return { auction: { ...auction, status: 'ended', winner_id: winner?.bidder_id, final_price: winner?.amount }, order, winner };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAuction(auctionId) {
  const { rows } = await pool.query(
    `SELECT a.*, i.title as item_title, i.description, i.image_urls, i.condition,
            i.seller_id, u.display_name as seller_name, sp.storefront_name,
            sp.avg_rating as seller_rating, sp.is_verified_seller,
            c.name as category_name,
            (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) as bid_count
     FROM auctions a
     JOIN items i ON i.id=a.item_id
     JOIN users u ON u.id=i.seller_id
     LEFT JOIN seller_profiles sp ON sp.user_id=i.seller_id
     LEFT JOIN categories c ON c.id=i.category_id
     WHERE a.id=$1`,
    [auctionId]
  );
  return rows[0] || null;
}

async function getAuctionBids(auctionId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT b.*, u.display_name as bidder_name
     FROM bids b JOIN users u ON u.id=b.bidder_id
     WHERE b.auction_id=$1
     ORDER BY b.placed_at DESC LIMIT $2`,
    [auctionId, limit]
  );
  return rows;
}

async function getLiveStats(auctionId) {
  const auction = await getAuction(auctionId);
  if (!auction) throw new AppError('Auction not found', 404, 'NOT_FOUND');

  // Compute bid velocity from Redis
  const velocityKey = `bid_velocity:${auctionId}`;
  const timestamps = await redis.lrange(velocityKey, 0, -1);
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recentBids = timestamps.filter(t => parseInt(t) > fiveMinAgo).length;
  const bidsPerMinute = recentBids / 5;

  return {
    ...auction,
    bids_per_minute: bidsPerMinute,
    recent_bid_count: recentBids,
  };
}

module.exports = { createAuction, updateAuction, placeBid, endAuction, getAuction, getAuctionBids, getLiveStats };
