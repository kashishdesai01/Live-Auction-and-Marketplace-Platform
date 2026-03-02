const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_12345');
const pool = require('../config/db');
const { getOrderSchema } = require('../services/orderSchema');

// The environment variable containing the Stripe Webhook Signing Secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function updateOrderStatusFromIntent(paymentIntent, nextStatus, statusColumn, hasStripePaymentIntentId) {
  const orderId = paymentIntent.metadata?.order_id;
  const auctionId = paymentIntent.metadata?.auction_id;

  const setClauses = [`${statusColumn} = $1`];
  const setParams = [nextStatus];
  if (hasStripePaymentIntentId) {
    setParams.push(paymentIntent.id);
    setClauses.push(`stripe_payment_intent_id = $2`);
  }

  if (orderId) {
    const whereIndex = setParams.length + 1;
    await pool.query(
      `UPDATE orders
       SET ${setClauses.join(', ')}
       WHERE id = $${whereIndex}`,
      [...setParams, orderId]
    );
    return;
  }

  if (hasStripePaymentIntentId) {
    const whereIndex = setParams.length + 1;
    await pool.query(
      `UPDATE orders
       SET ${setClauses.join(', ')}
       WHERE stripe_payment_intent_id = $${whereIndex}`,
      [...setParams, paymentIntent.id]
    );
    return;
  }

  if (auctionId) {
    const whereIndex = setParams.length + 1;
    await pool.query(
      `UPDATE orders
       SET ${setClauses.join(', ')}
       WHERE auction_id = $${whereIndex}`,
      [...setParams, auctionId]
    );
  }
}

router.post('/', async (req, res) => {
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET; cannot validate Stripe webhook.');
    return res.status(500).json({ error: 'Webhook secret is not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Construct the event using the raw un-parsed body (which express.raw gives us)
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event types we care about
  try {
    const { statusColumn, hasStripePaymentIntentId } = await getOrderSchema();

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent for ${paymentIntent.amount} was successful! ID: ${paymentIntent.id}`);
        await updateOrderStatusFromIntent(paymentIntent, 'paid', statusColumn, hasStripePaymentIntentId);
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent ${paymentIntent.id} failed.`);
        await updateOrderStatusFromIntent(paymentIntent, 'failed', statusColumn, hasStripePaymentIntentId);
        break;
      }
      
      default:
        // Unhandled event type
        console.log(`Unhandled event type ${event.type}`);
    }

    // Acknowledge receipt of the event
    res.json({ received: true });
  } catch (dbErr) {
    console.error('Error updating DB during webhook:', dbErr);
    // Return 500 to tell Stripe to retry
    return res.status(500).json({ error: 'Database update failed' });
  }
});

module.exports = router;
