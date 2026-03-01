const pool = require('../config/db');
const { AppError } = require('../middleware/error');

async function createItem(sellerId, data) {
  const { title, description, category_id, subcategory_id, image_urls, condition, starting_price, reserve_price } = data;

  const { rows } = await pool.query(
    `INSERT INTO items (seller_id, title, description, category_id, subcategory_id, image_urls, condition, starting_price, reserve_price, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')
     RETURNING *`,
    [sellerId, title, description, category_id, subcategory_id || null, image_urls || [], condition, starting_price, reserve_price || null]
  );
  return rows[0];
}

async function updateItem(sellerId, itemId, data) {
  const existing = await getItemById(itemId);
  if (!existing) throw new AppError('Item not found', 404, 'NOT_FOUND');
  if (existing.seller_id !== sellerId) throw new AppError('Not your item', 403, 'FORBIDDEN');
  if (existing.status === 'sold') throw new AppError('Cannot edit sold item', 400, 'ITEM_SOLD');

  const fields = ['title','description','category_id','subcategory_id','image_urls','condition','starting_price','reserve_price','status'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = $${idx++}`);
      values.push(data[field]);
    }
  }
  if (updates.length === 0) return existing;

  updates.push(`updated_at = NOW()`);
  values.push(itemId);

  const { rows } = await pool.query(
    `UPDATE items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0];
}

async function deleteItem(sellerId, itemId) {
  const existing = await getItemById(itemId);
  if (!existing) throw new AppError('Item not found', 404, 'NOT_FOUND');
  if (existing.seller_id !== sellerId) throw new AppError('Not your item', 403, 'FORBIDDEN');

  if (existing.status === 'draft') {
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
  } else {
    await pool.query("UPDATE items SET status='ended' WHERE id=$1", [itemId]);
  }
  return { deleted: true };
}

async function getSellerItems(sellerId, { status, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = ['i.seller_id = $1'];
  const values = [sellerId];
  let idx = 2;

  if (status) { conditions.push(`i.status = $${idx++}`); values.push(status); }

  const { rows } = await pool.query(
    `SELECT i.*, c.name as category_name, sc.name as subcategory_name,
            (SELECT COUNT(*) FROM auctions a WHERE a.item_id = i.id) as auction_count
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN categories sc ON sc.id = i.subcategory_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    [...values, limit, offset]
  );
  return rows;
}

async function getItemById(itemId) {
  const { rows } = await pool.query(
    `SELECT i.*, u.display_name as seller_name, u.avatar_url as seller_avatar,
            sp.storefront_name, sp.avg_rating as seller_rating, sp.is_verified_seller,
            c.name as category_name, sc.name as subcategory_name
     FROM items i
     JOIN users u ON u.id = i.seller_id
     LEFT JOIN seller_profiles sp ON sp.user_id = i.seller_id
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN categories sc ON sc.id = i.subcategory_id
     WHERE i.id = $1`,
    [itemId]
  );
  return rows[0] || null;
}

async function getItems({ q, category_id, subcategory_id, condition, price_min, price_max, sort = 'newest', page = 1, limit = 24 } = {}) {
  const conditions = ["i.status = 'active'"];
  const values = [];
  let idx = 1;

  if (category_id) { conditions.push(`i.category_id = $${idx++}`); values.push(category_id); }
  if (subcategory_id) { conditions.push(`i.subcategory_id = $${idx++}`); values.push(subcategory_id); }
  if (condition) { conditions.push(`i.condition = $${idx++}`); values.push(condition); }
  if (price_min) { conditions.push(`i.starting_price >= $${idx++}`); values.push(price_min); }
  if (price_max) { conditions.push(`i.starting_price <= $${idx++}`); values.push(price_max); }
  if (q) { conditions.push(`i.search_vector @@ plainto_tsquery('english', $${idx++})`); values.push(q); }

  const orderMap = {
    newest: 'i.created_at DESC',
    price_asc: 'i.starting_price ASC',
    price_desc: 'i.starting_price DESC',
  };
  const orderBy = orderMap[sort] || 'i.created_at DESC';
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT i.*, c.name as category_name, sc.name as subcategory_name,
            a.id as auction_id, a.status as auction_status, a.end_time, a.current_price
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN categories sc ON sc.id = i.subcategory_id
     LEFT JOIN auctions a ON a.item_id = i.id AND a.status IN ('live','scheduled')
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT $${idx++} OFFSET $${idx}`,
    [...values, limit, offset]
  );
  return rows;
}

module.exports = { createItem, updateItem, deleteItem, getSellerItems, getItemById, getItems };
