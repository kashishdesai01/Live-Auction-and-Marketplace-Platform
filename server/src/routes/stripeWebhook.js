const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_12345');
const pool = require('../config/db');

// The environment variable containing the Stripe Webhook Signing Secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/', async (req, res) => {
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
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent for ${paymentIntent.amount} was successful! ID: ${paymentIntent.id}`);
        // Update the order in our DB
        await pool.query(
          "UPDATE orders SET status = 'paid' WHERE stripe_payment_intent_id = $1",
          [paymentIntent.id]
        );
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent ${paymentIntent.id} failed.`);
        // Update order status to failed, we can notify buyer later
        await pool.query(
          "UPDATE orders SET status = 'failed' WHERE stripe_payment_intent_id = $1",
          [paymentIntent.id]
        );
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
