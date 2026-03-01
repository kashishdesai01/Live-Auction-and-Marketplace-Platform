const pool = require('../config/db');
const redis = require('../config/redis');

const CATEGORY_CACHE_KEY = 'categories:tree';
const CACHE_TTL = 3600; // 1 hour

async function getCategoryTree() {
  const cached = await redis.get(CATEGORY_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const { rows } = await pool.query(
    'SELECT * FROM categories WHERE is_active = TRUE ORDER BY display_order, name'
  );

  // Build tree structure
  const parents = rows.filter(c => !c.parent_id);
  const tree = parents.map(parent => ({
    ...parent,
    children: rows.filter(c => c.parent_id === parent.id),
  }));

  await redis.setex(CATEGORY_CACHE_KEY, CACHE_TTL, JSON.stringify(tree));
  return tree;
}

async function updateUserInterests(userId, categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length < 1) {
    throw new Error('At least 1 category required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing interests
    await client.query('DELETE FROM user_category_interests WHERE user_id = $1', [userId]);

    // Insert new ones with default affinity score of 10
    for (const catId of categoryIds) {
      await client.query(
        `INSERT INTO user_category_interests (user_id, category_id, affinity_score)
         VALUES ($1, $2, 10) ON CONFLICT DO NOTHING`,
        [userId, catId]
      );
    }

    // Mark onboarding complete
    await client.query(
      'UPDATE buyer_profiles SET onboarding_completed = TRUE WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');
    return { updated: categoryIds.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getUserInterests(userId) {
  const { rows } = await pool.query(
    `SELECT uci.*, c.name, c.slug, c.icon_url, p.name as parent_name
     FROM user_category_interests uci
     JOIN categories c ON c.id = uci.category_id
     LEFT JOIN categories p ON p.id = c.parent_id
     WHERE uci.user_id = $1
     ORDER BY uci.affinity_score DESC`,
    [userId]
  );
  return rows;
}

async function incrementAffinity(userId, categoryId, action) {
  const POINTS = { bid: 2, win: 5, watchlist: 1, view: 0.5, select: 10 };
  const delta = POINTS[action] || 0;
  if (!delta) return;

  await pool.query(
    `INSERT INTO user_category_interests (user_id, category_id, affinity_score, last_updated)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, category_id)
     DO UPDATE SET affinity_score = user_category_interests.affinity_score + $3,
                   last_updated = NOW()`,
    [userId, categoryId, delta]
  );
}

module.exports = { getCategoryTree, updateUserInterests, getUserInterests, incrementAffinity };
