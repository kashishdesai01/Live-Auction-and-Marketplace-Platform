const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

// GET /api/sellers — list all verified sellers
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sp.user_id as id, sp.storefront_name, sp.is_verified_seller, sp.avg_rating, sp.total_sales,
              u.display_name, u.created_at
       FROM seller_profiles sp
       JOIN users u ON u.id = sp.user_id
       ORDER BY sp.total_sales DESC NULLS LAST
       LIMIT 50`
    );
    res.json({ sellers: rows });
  } catch (err) { next(err); }
});

// GET /api/sellers/:id — public storefront
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get seller profile
    const sellerRes = await pool.query(
      `SELECT sp.*, u.display_name, u.created_at, u.email
       FROM seller_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.user_id = $1`,
      [id]
    );

    if (!sellerRes.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Seller not found' } });
    }

    const seller = sellerRes.rows[0];

    // Get active auctions from this seller
    const auctionsRes = await pool.query(
      `SELECT a.id, a.status, a.current_price, a.end_time, a.start_time, a.viewer_count,
              i.title as item_title, i.image_urls, i.condition, i.category_id,
              (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) as bid_count
       FROM auctions a
       JOIN items i ON i.id = a.item_id
       WHERE i.seller_id = $1 AND a.status IN ('live', 'scheduled')
       ORDER BY a.status = 'live' DESC, a.end_time ASC
       LIMIT 20`,
      [id]
    );

    res.json({
      seller: {
        id: seller.user_id,
        display_name: seller.display_name,
        storefront_name: seller.storefront_name,
        is_verified_seller: seller.is_verified_seller,
        avg_rating: seller.avg_rating,
        total_sales: seller.total_sales,
        bio: seller.bio,
        created_at: seller.created_at,
        stripe_onboarding_complete: seller.stripe_onboarding_complete,
      },
      auctions: auctionsRes.rows.map(a => ({
        id: a.id,
        status: a.status,
        current_price: a.current_price,
        end_time: a.end_time,
        start_time: a.start_time,
        viewer_count: a.viewer_count,
        bid_count: a.bid_count,
        item_title: a.item_title,
        item_image: a.image_urls?.[0],
        condition: a.condition,
        category_id: a.category_id,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
