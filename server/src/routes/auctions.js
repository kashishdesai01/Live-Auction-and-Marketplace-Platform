const express = require('express');
const router = express.Router();
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const auctionService = require('../services/auctionService');
const categoryService = require('../services/categoryService');

// GET /api/auctions/:id — auction detail (public)
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auction = await auctionService.getAuction(req.params.id);
    if (!auction) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Auction not found' } });
    const bids = await auctionService.getAuctionBids(req.params.id);

    // Check if user is watching
    let is_watching = false;
    if (req.user) {
      const pool = require('../config/db');
      const { rows } = await pool.query(
        'SELECT 1 FROM watchlist WHERE user_id=$1 AND auction_id=$2',
        [req.user.sub, req.params.id]
      );
      is_watching = rows.length > 0;
    }

    res.json({ auction, bids, is_watching });
  } catch (err) { next(err); }
});

// POST /api/auctions/:id/bid — place bid (buyer only)
router.post('/:id/bid', authenticate, requireRole('buyer'), [
  body('amount').isFloat({ min: 0.01 }),
  body('idempotency_key').isUUID(),
  validate,
], async (req, res, next) => {
  try {
    const { amount, idempotency_key } = req.body;
    const result = await auctionService.placeBid(req.params.id, req.user.sub, amount, idempotency_key);

    if (!result.accepted) {
      return res.status(400).json({ error: { code: 'BID_REJECTED', reason: result.reason } });
    }

    // Track affinity
    const pool = require('../config/db');
    const { rows } = await pool.query(
      'SELECT i.category_id FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1',
      [req.params.id]
    );
    if (rows[0] && req.user) {
      await categoryService.incrementAffinity(req.user.sub, rows[0].category_id, 'bid');
    }

    res.json({ accepted: true, new_price: result.newPrice });
  } catch (err) { next(err); }
});

module.exports = router;
