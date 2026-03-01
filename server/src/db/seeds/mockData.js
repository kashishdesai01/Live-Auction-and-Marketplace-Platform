require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const pool = require('../../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function seedMocks() {
  const client = await pool.connect();
  try {
    console.log('Starting mock data seed...');
    await client.query('BEGIN');

    // 1. Create Users
    const passwordHash = await bcrypt.hash('password123', 12);
    
    const buyerRes = await client.query(
      `INSERT INTO users (email, password_hash, display_name, roles, active_role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['buyer@example.com', passwordHash, 'Alice (Buyer)', ['buyer'], 'buyer']
    );
    const buyerId = buyerRes.rows[0].id;
    await client.query('INSERT INTO buyer_profiles (user_id) VALUES ($1)', [buyerId]);

    const sellerRes = await client.query(
      `INSERT INTO users (email, password_hash, display_name, roles, active_role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['seller@example.com', passwordHash, 'Bob (Seller)', ['seller', 'buyer'], 'seller']
    );
    const sellerId = sellerRes.rows[0].id;
    await client.query('INSERT INTO seller_profiles (user_id, storefront_name) VALUES ($1, $2)', [sellerId, "Bob's Vintage Vault"]);

    // 2. Get some categories
    const catRes = await client.query('SELECT id FROM categories WHERE parent_id IS NOT NULL LIMIT 5');
    const categories = catRes.rows.map(r => r.id);
    if (categories.length === 0) {
      throw new Error('No categories found. Run run.js first.');
    }

    // 3. Create Items
    const items = [
      { title: '1st Edition Charizard Holographic', desc: 'Mint condition PSA 10', price: 5000, condition: 'like_new', status: 'active', cat: categories[0] },
      { title: 'Vintage Rolex Submariner', desc: '1980 model, original box', price: 8500, condition: 'good', status: 'active', cat: categories[1] },
      { title: 'Signed Michael Jordan Jersey', desc: 'Authentic with certificate', price: 2000, condition: 'like_new', status: 'sold', cat: categories[2] },
      { title: 'Original 1977 Star Wars Poster', desc: 'Slight wear on edges', price: 300, condition: 'fair', status: 'draft', cat: categories[3] }
    ];

    const insertedItems = [];
    for (const item of items) {
      const res = await client.query(
        `INSERT INTO items (seller_id, title, description, category_id, condition, starting_price, status, image_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [sellerId, item.title, item.desc, item.cat, item.condition, item.price, item.status, 
         ['https://images.unsplash.com/photo-1610484826967-09c5720778c7?w=800&q=80']]
      );
      insertedItems.push({ id: res.rows[0].id, ...item });
    }

    // 4. Create Auctions
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursFromNow = new Date(now.getTime() + 120 * 60 * 1000);

    // Live Auction
    const liveAuctionRes = await client.query(
      `INSERT INTO auctions (item_id, start_time, end_time, current_price, status, viewer_count)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [insertedItems[0].id, oneHourAgo, oneHourFromNow, 5500, 'live', 12]
    );
    const liveAuctionId = liveAuctionRes.rows[0].id;

    // Scheduled Auction
    await client.query(
      `INSERT INTO auctions (item_id, start_time, end_time, current_price, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [insertedItems[1].id, oneHourFromNow, twoHoursFromNow, 8500, 'scheduled']
    );

    // Ended Auction
    const endedAuctionRes = await client.query(
      `INSERT INTO auctions (item_id, start_time, end_time, current_price, status, winner_id, final_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [insertedItems[2].id, new Date(now.getTime() - 2 * 60 * 60 * 1000), oneHourAgo, 2500, 'ended', buyerId, 2500]
    );

    // 5. Create Bids (on live auction)
    await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)`,
      [liveAuctionId, buyerId, 5500, 'active', crypto.randomUUID()]
    );

    // 6. Create Order (for ended auction)
    await client.query(
      `INSERT INTO orders (auction_id, buyer_id, seller_id, amount, shipping_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [endedAuctionRes.rows[0].id, buyerId, sellerId, 2500, 'pending']
    );

    await client.query('COMMIT');
    console.log('✅ Mock data seeded successfully!');
    console.log('Buyer Login: buyer@example.com / password123');
    console.log('Seller Login: seller@example.com / password123');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedMocks();
