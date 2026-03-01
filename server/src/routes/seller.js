const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const itemService = require('../services/itemService');
const auctionService = require('../services/auctionService');
const pool = require('../config/db');

const sellerAuth = [authenticate, requireRole('seller')];

// ---- Items ----

// GET /api/seller/items
router.get('/items', sellerAuth, async (req, res, next) => {
  try {
    const items = await itemService.getSellerItems(req.user.sub, req.query);
    res.json({ items });
  } catch (err) { next(err); }
});

// ---- Stripe Connect Onboarding ----
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const CLIENT_URL = process.env.CORS_ORIGIN || 'http://localhost:3000';

// POST /api/seller/stripe/account -- Start onboarding
router.post('/stripe/account', sellerAuth, async (req, res, next) => {
  try {
    const sellerId = req.user.sub;
    
    // Check if they already have an account ID
    let { rows } = await pool.query('SELECT stripe_account_id FROM seller_profiles WHERE user_id=$1', [sellerId]);
    let stripeAccountId = rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      // Create a new Express Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        email: req.user.email,
        capabilities: { transfers: { requested: true } },
        business_type: 'individual'
      });
      stripeAccountId = account.id;

      // Save to database
      await pool.query(
        `INSERT INTO seller_profiles (user_id, stripe_account_id) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET stripe_account_id = $2`,
        [sellerId, stripeAccountId]
      );
    }

    // Generate the hosted onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${CLIENT_URL}/settings/seller`,
      return_url: `http://localhost:5001/api/seller/stripe/verify?session_id=${stripeAccountId}`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) { next(err); }
});

// GET /api/seller/stripe/verify -- Callback after Stripe redirects back
router.get('/stripe/verify', async (req, res, next) => {
  try {
    const { session_id } = req.query; // this is the stripeAccountId
    if (!session_id) return res.redirect(`${CLIENT_URL}/settings/seller?stripe=error`);

    // Verify the account is fully enabled
    const account = await stripe.accounts.retrieve(session_id);
    
    if (account.details_submitted && account.charges_enabled) {
      await pool.query(
        'UPDATE seller_profiles SET stripe_onboarding_complete = TRUE WHERE stripe_account_id = $1',
        [session_id]
      );
      res.redirect(`${CLIENT_URL}/settings/seller?stripe=success`);
    } else {
      res.redirect(`${CLIENT_URL}/settings/seller?stripe=incomplete`);
    }
  } catch (err) {
    res.redirect(`${CLIENT_URL}/settings/seller?stripe=api_error`);
  }
});

// PUT /api/seller/profile
router.put('/profile', sellerAuth, async (req, res, next) => {
  try {
    const { storefront_name, bio, display_name } = req.body;
    
    // Update display_name in users table if provided
    if (display_name) {
      await pool.query('UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2', [display_name, req.user.sub]);
    }

    // Update or create seller_profile
    if (storefront_name !== undefined || bio !== undefined) {
      await pool.query(
        `INSERT INTO seller_profiles (user_id, storefront_name, bio) 
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
            storefront_name = COALESCE(EXCLUDED.storefront_name, seller_profiles.storefront_name),
            bio = COALESCE(EXCLUDED.bio, seller_profiles.bio),
            updated_at = NOW()`,
        [req.user.sub, storefront_name, bio]
      );
    }
    
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/seller/items
router.post('/items', sellerAuth, [
  body('title').trim().isLength({ min: 3, max: 255 }),
  body('starting_price').isFloat({ min: 0.01 }),
  body('condition').isIn(['new','like_new','good','fair','poor']),
  validate,
], async (req, res, next) => {
  try {
    const item = await itemService.createItem(req.user.sub, req.body);
    res.status(201).json({ item });
  } catch (err) { next(err); }
});

// PATCH /api/seller/items/:id
router.patch('/items/:id', sellerAuth, async (req, res, next) => {
  try {
    const item = await itemService.updateItem(req.user.sub, req.params.id, req.body);
    res.json({ item });
  } catch (err) { next(err); }
});

// DELETE /api/seller/items/:id
router.delete('/items/:id', sellerAuth, async (req, res, next) => {
  try {
    const result = await itemService.deleteItem(req.user.sub, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Auctions ----

// POST /api/seller/auctions
router.post('/auctions', sellerAuth, [
  body('item_id').isUUID(),
  body('start_time').isISO8601(),
  body('end_time').isISO8601(),
  body('bid_increment').optional().isFloat({ min: 0.01 }),
  validate,
], async (req, res, next) => {
  try {
    const auction = await auctionService.createAuction(req.user.sub, req.body);
    res.status(201).json({ auction });
  } catch (err) { next(err); }
});

// PATCH /api/seller/auctions/:id
router.patch('/auctions/:id', sellerAuth, async (req, res, next) => {
  try {
    const auction = await auctionService.updateAuction(req.user.sub, req.params.id, req.body);
    res.json({ auction });
  } catch (err) { next(err); }
});

// GET /api/seller/auctions/:id/live
router.get('/auctions/:id/live', sellerAuth, async (req, res, next) => {
  try {
    const stats = await auctionService.getLiveStats(req.params.id);
    res.json({ stats });
  } catch (err) { next(err); }
});

// ---- Dashboard + Analytics ----

// GET /api/seller/dashboard
router.get('/dashboard', sellerAuth, async (req, res, next) => {
  try {
    const analyticsService = require('../services/analyticsService');
    const metrics = await analyticsService.getDashboardMetrics(req.user.sub);
    res.json({ metrics });
  } catch (err) { next(err); }
});

// GET /api/seller/analytics
router.get('/analytics', sellerAuth, async (req, res, next) => {
  try {
    const analyticsService = require('../services/analyticsService');
    const data = await analyticsService.getAnalytics(req.user.sub, req.query);
    res.json(data);
  } catch (err) { next(err); }
});

// ---- Orders ----

// GET /api/seller/orders
router.get('/orders', sellerAuth, async (req, res, next) => {
  try {
    const pool = require('../config/db');
    const { rows } = await pool.query(
      `SELECT o.*, u.display_name as buyer_name, bp.shipping_address,
              a.final_price, i.title as item_title, i.image_urls[1] as item_image
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       LEFT JOIN buyer_profiles bp ON bp.user_id = o.buyer_id
       JOIN auctions a ON a.id = o.auction_id
       JOIN items i ON i.id = a.item_id
       WHERE o.seller_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.sub]
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// PATCH /api/seller/orders/:id/ship
router.patch('/orders/:id/ship', sellerAuth, [
  body('tracking_number').trim().notEmpty(),
  validate,
], async (req, res, next) => {
  try {
    const pool = require('../config/db');
    const { rows } = await pool.query(
      `UPDATE orders SET shipping_status='shipped', tracking_number=$1
       WHERE id=$2 AND seller_id=$3 RETURNING *`,
      [req.body.tracking_number, req.params.id, req.user.sub]
    );
    if (!rows[0]) throw { isOperational: true, statusCode: 404, code: 'NOT_FOUND', message: 'Order not found' };
    
    // Notify buyer
    const notificationService = require('../services/notificationService');
    await notificationService.createNotification(rows[0].buyer_id, 'order_update', {
      order_id: rows[0].id,
      tracking_number: rows[0].tracking_number,
      message: 'Your item has been shipped!',
    });

    res.json({ order: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
