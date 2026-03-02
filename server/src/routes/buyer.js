const express = require('express');
const router = express.Router();
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const feedService = require('../services/feedService');
const categoryService = require('../services/categoryService');
const notificationService = require('../services/notificationService');
const pool = require('../config/db');
const { getOrderSchema } = require('../services/orderSchema');

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

function isStripeConfigured() {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return false;
  if (key === 'sk_test_dummy' || key === 'sk_test_12345' || key.includes('...')) return false;
  return true;
}

const SANDBOX_SCENARIOS = {
  success: 'pm_card_visa',
  decline: 'pm_card_chargeDeclined',
  auth: 'pm_card_authenticationRequired',
};

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
      `SELECT w.*, a.id, a.current_price, a.end_time, a.status as auction_status,
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

// POST /api/buyer/orders/:id/pay
// Manual fallback payment path for pending/failed orders.
router.post('/orders/:id/pay', buyerAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { statusColumn, hasStripePaymentIntentId } = await getOrderSchema(client);

    const { rows: orderRows } = await client.query(
      `SELECT o.*, a.item_id
       FROM orders o
       JOIN auctions a ON a.id = o.auction_id
       WHERE o.id = $1 AND o.buyer_id = $2
       FOR UPDATE`,
      [req.params.id, req.user.sub]
    );
    const order = orderRows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const currentStatus = order[statusColumn];
    if (currentStatus === 'paid') {
      await client.query('COMMIT');
      return res.json({ order, paid: true, mode: 'already_paid' });
    }
    if (!['pending', 'failed'].includes(currentStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Order cannot be paid in current state.' } });
    }

    const requestedMode = String(req.query.mode || '').toLowerCase();
    const mode = requestedMode || (isStripeConfigured() ? 'sandbox' : 'demo');
    const scenario = String(req.query.scenario || 'success').toLowerCase();
    const hasWebhookSecret = Boolean((process.env.STRIPE_WEBHOOK_SECRET || '').trim());

    if (!['sandbox', 'vaulted', 'demo'].includes(mode)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'INVALID_MODE',
          message: 'Unsupported payment mode. Use sandbox, vaulted, or demo.',
        },
      });
    }

    if (mode === 'sandbox' && !SANDBOX_SCENARIOS[scenario]) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'INVALID_SCENARIO',
          message: 'Unsupported sandbox scenario. Use success, decline, or auth.',
        },
      });
    }

    if (mode !== 'demo' && !isStripeConfigured()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'STRIPE_NOT_CONFIGURED',
          message: 'Stripe is not configured. Add STRIPE_SECRET_KEY or use mode=demo.',
        },
      });
    }

    const updateOrderState = async (nextStatus, paymentIntentId = null) => {
      const updateParams = [nextStatus, order.id];
      const updateClauses = [`${statusColumn} = $1`];
      if (hasStripePaymentIntentId && paymentIntentId) {
        updateParams.push(paymentIntentId);
        updateClauses.push(`stripe_payment_intent_id = $3`);
      }
      const { rows: updatedRows } = await client.query(
        `UPDATE orders
         SET ${updateClauses.join(', ')}
         WHERE id = $2
         RETURNING *`,
        updateParams
      );
      return updatedRows[0];
    };

    if (mode === 'demo') {
      const updatedOrder = await updateOrderState('paid');
      await client.query('COMMIT');
      return res.json({ order: updatedOrder, paid: true, mode: 'demo' });
    }

    const amountCents = Math.round(Number(order.amount) * 100);
    const { rows: sellerRows } = await client.query(
      'SELECT stripe_account_id FROM seller_profiles WHERE user_id = $1',
      [order.seller_id]
    );
    const sellerAccountId = sellerRows[0]?.stripe_account_id;

    if (mode === 'sandbox') {
      const intentPayload = {
        amount: amountCents,
        currency: 'usd',
        confirm: true,
        payment_method: SANDBOX_SCENARIOS[scenario],
        metadata: {
          order_id: order.id,
          auction_id: order.auction_id,
          item_id: order.item_id,
          buyer_id: req.user.sub,
          seller_id: order.seller_id,
          scenario,
        },
      };

      if (sellerAccountId) {
        intentPayload.transfer_data = { destination: sellerAccountId };
        intentPayload.application_fee_amount = Math.round(amountCents * 0.05);
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create(intentPayload);
        const nextStatus = paymentIntent.status === 'succeeded' && !hasWebhookSecret ? 'paid' : 'pending';
        const updatedOrder = await updateOrderState(nextStatus, paymentIntent.id);
        await client.query('COMMIT');
        return res.json({
          order: updatedOrder,
          paid: nextStatus === 'paid',
          mode: 'sandbox',
          scenario,
          webhook_expected: hasWebhookSecret,
          payment_intent_status: paymentIntent.status,
        });
      } catch (payErr) {
        const piId = payErr?.raw?.payment_intent?.id || payErr?.payment_intent?.id || null;
        const isAuthRequired =
          payErr?.code === 'authentication_required' ||
          payErr?.raw?.code === 'authentication_required' ||
          payErr?.raw?.payment_intent?.status === 'requires_action';
        const nextStatus = isAuthRequired ? 'pending' : 'failed';
        const updatedOrder = await updateOrderState(nextStatus, piId);
        await client.query('COMMIT');
        return res.status(isAuthRequired ? 202 : 402).json({
          error: {
            code: isAuthRequired ? 'AUTHENTICATION_REQUIRED' : 'PAYMENT_FAILED',
            message: payErr.message || (isAuthRequired ? 'Authentication required to complete payment.' : 'Payment failed'),
          },
          order: updatedOrder,
          paid: false,
          mode: 'sandbox',
          scenario,
          payment_intent_status: payErr?.raw?.payment_intent?.status || 'failed',
        });
      }
    }

    const { rows: buyerRows } = await client.query(
      'SELECT stripe_customer_id FROM buyer_profiles WHERE user_id = $1',
      [req.user.sub]
    );
    const buyerCustomerId = buyerRows[0]?.stripe_customer_id;
    if (!buyerCustomerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'PAYMENT_METHOD_REQUIRED',
          message: 'No saved payment method found. Add a card before paying.',
        },
      });
    }

    const pms = await stripe.paymentMethods.list({ customer: buyerCustomerId, type: 'card' });
    const paymentMethod = pms.data[0]?.id;
    if (!paymentMethod) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'PAYMENT_METHOD_REQUIRED',
          message: 'No saved card available. Please set up a card first.',
        },
      });
    }

    const intentPayload = {
      amount: amountCents,
      currency: 'usd',
      customer: buyerCustomerId,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true,
      metadata: {
        order_id: order.id,
        auction_id: order.auction_id,
        item_id: order.item_id,
        buyer_id: req.user.sub,
        seller_id: order.seller_id,
      },
    };

    if (sellerAccountId) {
      intentPayload.transfer_data = { destination: sellerAccountId };
      intentPayload.application_fee_amount = Math.round(amountCents * 0.05);
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(intentPayload);
    } catch (payErr) {
      const updatedOrder = await updateOrderState('failed', payErr?.raw?.payment_intent?.id || null);
      await client.query('COMMIT');
      return res.status(402).json({
        error: { code: 'PAYMENT_FAILED', message: payErr.message || 'Payment failed' },
        order: updatedOrder,
      });
    }

    const nextStatus = paymentIntent.status === 'succeeded' && !hasWebhookSecret ? 'paid' : 'pending';
    const updatedOrder = await updateOrderState(nextStatus, paymentIntent.id);
    await client.query('COMMIT');
    return res.json({
      order: updatedOrder,
      paid: nextStatus === 'paid',
      mode: 'vaulted',
      webhook_expected: hasWebhookSecret,
      payment_intent_status: paymentIntent.status,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
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
