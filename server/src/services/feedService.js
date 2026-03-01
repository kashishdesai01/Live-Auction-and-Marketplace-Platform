const pool = require('../config/db');

async function getPersonalizedFeed(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  // Check if user has enough interactions (cold start threshold = 3)
  const { rows: interestCheck } = await pool.query(
    'SELECT COUNT(*) FROM user_category_interests WHERE user_id=$1', [userId]
  );
  const interestCount = parseInt(interestCheck[0].count);

  if (interestCount < 3) {
    return getTrendingFeed(page, limit);
  }

  const { rows } = await pool.query(
    `SELECT a.*,
            i.title as item_title, i.description, i.image_urls, i.condition, i.category_id,
            u.display_name as seller_name, sp.is_verified_seller,
            c.name as category_name,
            (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) as bid_count,
            COALESCE(uci.affinity_score, 0.1)
              * (1.0 / (EXTRACT(EPOCH FROM (NOW() - a.start_time))/3600.0 + 1)) AS feed_score
     FROM auctions a
     JOIN items i ON a.item_id = i.id
     JOIN users u ON u.id = i.seller_id
     LEFT JOIN seller_profiles sp ON sp.user_id = i.seller_id
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN user_category_interests uci
       ON uci.user_id = $1 AND uci.category_id = i.category_id
     WHERE a.status = 'live'
     ORDER BY feed_score DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

async function getTrendingFeed(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT a.*,
            i.title as item_title, i.description, i.image_urls, i.condition,
            u.display_name as seller_name, sp.is_verified_seller,
            c.name as category_name,
            COUNT(b.id) FILTER (WHERE b.placed_at > NOW() - INTERVAL '24 hours') as recent_bids
     FROM auctions a
     JOIN items i ON a.item_id = i.id
     JOIN users u ON u.id = i.seller_id
     LEFT JOIN seller_profiles sp ON sp.user_id = i.seller_id
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN bids b ON b.auction_id = a.id
     WHERE a.status = 'live'
     GROUP BY a.id, i.title, i.description, i.image_urls, i.condition,
              u.display_name, sp.is_verified_seller, c.name
     ORDER BY recent_bids DESC, a.current_price DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

module.exports = { getPersonalizedFeed, getTrendingFeed };
