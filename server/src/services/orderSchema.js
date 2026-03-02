const pool = require('../config/db');

let cachedOrderSchema = null;

async function getOrderSchema(queryable = pool) {
  if (cachedOrderSchema) return cachedOrderSchema;

  const { rows } = await queryable.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders'`
  );

  const cols = new Set(rows.map((r) => r.column_name));
  const statusColumn = cols.has('payment_status') ? 'payment_status' : 'status';

  cachedOrderSchema = {
    statusColumn,
    hasStripePaymentIntentId: cols.has('stripe_payment_intent_id'),
  };

  return cachedOrderSchema;
}

module.exports = { getOrderSchema };
