const pool = require('../config/db');

async function getDashboardMetrics(sellerId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(DISTINCT o.id) FILTER (WHERE o.payment_status='paid') as total_sales,
       COALESCE(SUM(o.amount) FILTER (WHERE o.payment_status='paid'), 0) as total_revenue,
       COUNT(DISTINCT a.id) FILTER (WHERE a.status='live') as active_auctions,
       COUNT(DISTINCT a.id) FILTER (WHERE a.status='ended') as ended_auctions,
       COUNT(DISTINCT a.id) FILTER (WHERE a.status='ended' AND a.winner_id IS NOT NULL) as sold_auctions,
       COALESCE(AVG(bid_counts.cnt) FILTER (WHERE a.status='ended'), 0) as avg_bids_per_auction,
       COUNT(DISTINCT i.id) FILTER (WHERE i.status='draft') as draft_items
     FROM items i
     LEFT JOIN auctions a ON a.item_id = i.id
     LEFT JOIN orders o ON o.auction_id = a.id
     LEFT JOIN (
       SELECT auction_id, COUNT(*) as cnt FROM bids GROUP BY auction_id
     ) bid_counts ON bid_counts.auction_id = a.id
     WHERE i.seller_id = $1`,
    [sellerId]
  );

  const metrics = rows[0];
  const conversionRate = metrics.ended_auctions > 0
    ? (metrics.sold_auctions / metrics.ended_auctions * 100).toFixed(1)
    : 0;

  return {
    ...metrics,
    conversion_rate: parseFloat(conversionRate),
  };
}

async function getAnalytics(sellerId, { range = '30d' } = {}) {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

  const { rows: revenueChart } = await pool.query(
    `SELECT DATE(o.created_at) as date, SUM(o.amount) as revenue, COUNT(o.id) as sales
     FROM orders o
     JOIN auctions a ON a.id=o.auction_id
     JOIN items i ON i.id=a.item_id
     WHERE i.seller_id=$1 AND o.payment_status='paid'
       AND o.created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(o.created_at)
     ORDER BY date`,
    [sellerId]
  );

  const { rows: topCategories } = await pool.query(
    `SELECT c.name, SUM(o.amount) as revenue, COUNT(o.id) as sales
     FROM orders o
     JOIN auctions a ON a.id=o.auction_id
     JOIN items i ON i.id=a.item_id
     JOIN categories c ON c.id=i.category_id
     WHERE i.seller_id=$1 AND o.payment_status='paid'
     GROUP BY c.name ORDER BY revenue DESC LIMIT 8`,
    [sellerId]
  );

  return { revenue_chart: revenueChart, top_categories: topCategories };
}

module.exports = { getDashboardMetrics, getAnalytics };
