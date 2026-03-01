const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');
const itemService = require('../services/itemService');
const { optionalAuth } = require('../middleware/auth');

// GET /api/browse/categories
router.get('/categories', async (req, res, next) => {
  try {
    const tree = await categoryService.getCategoryTree();
    res.json({ categories: tree });
  } catch (err) { next(err); }
});

// GET /api/browse — all listings with filters
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, category_id, subcategory_id, condition, price_min, price_max, sort, page } = req.query;
    const items = await itemService.getItems({
      q, category_id, subcategory_id, condition,
      price_min: price_min ? Number(price_min) : undefined,
      price_max: price_max ? Number(price_max) : undefined,
      sort, page: parseInt(page) || 1,
    });
    res.json({ items });
  } catch (err) { next(err); }
});

module.exports = router;
