const express = require('express');
const router = express.Router();
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const feedService = require('../services/feedService');
const categoryService = require('../services/categoryService');
const notificationService = require('../services/notificationService');
const pool = require('../config/db');

const buyerAuth = [authenticate, requireRole('buyer')];

// GET /api/feed — personalized or trending
router.get('/feed', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const feed = req.user
      ? await feedService.getPersonalizedFeed(req.user.sub, page)
      : await feedService.getTrendingFeed(page);
    res.json({ feed });
  } catch (err) { next(err); }
});

// ---- Stripe Payment Vaulting ----
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_12345');

// POST /api/buyer/stripe/setup -- Generate a SetupIntent client_secret to vault a card
router.post('/stripe/setup', buyerAuth, async (req, res, next) => {
  try {
    const buyerId = req.user.sub;
    
    // Check if they already have a Stripe Customer ID
    let { rows } = await pool.query('SELECT stripe_customer_id FROM buyer_profiles WHERE user_id=$1', [buyerId]);
    let customerId = rows[0]?.stripe_customer_id;

    if (!customerId) {
      // Create a new Customer
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.display_name,
        metadata: { user_id: buyerId }
      });
      customerId = customer.id;

      // Save to database
      await pool.query(
        `INSERT INTO buyer_profiles (user_id, stripe_customer_id) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = $2`,
        [buyerId, customerId]
      );
    }

    // Create a SetupIntent to vault the card
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // Required so we can charge them automatically later when they win
    });

    res.json({ client_secret: setupIntent.client_secret });
  } catch (err) { next(err); }
});

// PATCH /api/buyer/interests
router.patch('/interests', buyerAuth, async (req, res, next) => {
  try {
    const { category_ids } = req.body;
    const result = await categoryService.updateUserInterests(req.user.sub, category_ids);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /api/buyer/profile
router.put('/profile', buyerAuth, async (req, res, next) => {
  try {
    const { display_name, notifications_enabled } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${idx++}`);
      values.push(display_name);
    }
    
    // In a real system we'd have a notifications table, but for now we'll just return success
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(req.user.sub);
      const { rows } = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, display_name, avatar_url`,
        values
      );
      res.json({ user: rows[0] });
    } else {
      res.json({ success: true });
    }
  } catch (err) { next(err); }
});

// GET /api/buyer/watchlist
router.get('/watchlist', buyerAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, a.current_price, a.end_time, a.status as auction_status,
              i.title as item_title, i.image_urls[1] as item_image,
              (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) as bid_count
       FROM watchlist w
       JOIN auctions a ON a.id=w.auction_id
       JOIN items i ON i.id=a.item_id
       WHERE w.user_id=$1
       ORDER BY w.added_at DESC`,
      [req.user.sub]
    );
    res.json({ watchlist: rows });
  } catch (err) { next(err); }
});

// POST /api/buyer/watchlist/:id
router.post('/watchlist/:id', buyerAuth, async (req, res, next) => {
  try {
    await pool.query(
      'INSERT INTO watchlist (user_id, auction_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.sub, req.params.id]
    );
    // Track affinity
    const { rows } = await pool.query(
      'SELECT i.category_id FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1',
      [req.params.id]
    );
    if (rows[0]) {
      await categoryService.incrementAffinity(req.user.sub, rows[0].category_id, 'watchlist');
    }
    res.json({ added: true });
  } catch (err) { next(err); }
});

// DELETE /api/buyer/watchlist/:id
router.delete('/watchlist/:id', buyerAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM watchlist WHERE user_id=$1 AND auction_id=$2', [req.user.sub, req.params.id]);
    res.json({ removed: true });
  } catch (err) { next(err); }
});

// GET /api/buyer/bids
router.get('/bids', buyerAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, i.title as item_title, i.image_urls[1] as item_image,
              a.end_time, a.status as auction_status, a.current_price
       FROM bids b
       JOIN auctions a ON a.id=b.auction_id
       JOIN items i ON i.id=a.item_id
       WHERE b.bidder_id=$1
       ORDER BY b.placed_at DESC LIMIT 50`,
      [req.user.sub]
    );
    res.json({ bids: rows });
  } catch (err) { next(err); }
});

// GET /api/buyer/wins
router.get('/wins', buyerAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, i.title as item_title, i.image_urls[1] as item_image,
              u.display_name as seller_name
       FROM orders o
       JOIN auctions a ON a.id=o.auction_id
       JOIN items i ON i.id=a.item_id
       JOIN users u ON u.id=o.seller_id
       WHERE o.buyer_id=$1
       ORDER BY o.created_at DESC`,
      [req.user.sub]
    );
    res.json({ wins: rows });
  } catch (err) { next(err); }
});

// GET /api/buyer/notifications
router.get('/notifications', buyerAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const notifications = await notificationService.getNotifications(req.user.sub, page);
    const unread = await notificationService.getUnreadCount(req.user.sub);
    res.json({ notifications, unread_count: unread });
  } catch (err) { next(err); }
});

// PATCH /api/buyer/notifications/:id/read
router.patch('/notifications/:id/read', buyerAuth, async (req, res, next) => {
  try {
    await notificationService.markRead(req.user.sub, req.params.id);
    res.json({ read: true });
  } catch (err) { next(err); }
});

// PATCH /api/buyer/notifications/read-all
router.patch('/notifications/read-all', buyerAuth, async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user.sub);
    res.json({ read: true });
  } catch (err) { next(err); }
});

module.exports = router;
