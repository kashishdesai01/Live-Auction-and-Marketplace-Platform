require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function setupTestData() {
  const client = await pool.connect();
  try {
    console.log('Generating test data for k6 load test...\n');
    const suffix = Math.floor(Math.random() * 1000000);

    const sellerRes = await client.query(`
      INSERT INTO users (email, password_hash, display_name, roles, active_role) 
      VALUES ($1, 'hash', 'Test Seller', ARRAY['seller'], 'seller') RETURNING id
    `, [`seller_${suffix}@test.k6.com`]);
    const sellerId = sellerRes.rows[0].id;

    const itemRes = await client.query(`
      INSERT INTO items (seller_id, title, description, starting_price, condition)
      VALUES ($1, 'k6 Load Item', 'Testing locks', 10.00, 'new') RETURNING id
    `, [sellerId]);
    const itemId = itemRes.rows[0].id;

    const startTime = new Date();
    const endTime = new Date(Date.now() + 1000 * 60 * 60);
    const auctionRes = await client.query(`
      INSERT INTO auctions (item_id, start_time, end_time, current_price, bid_increment, status)
      VALUES ($1, $2, $3, 10.00, 1.00, 'live') RETURNING id
    `, [itemId, startTime, endTime]);
    const auctionId = auctionRes.rows[0].id;

    console.log(`✅ Auction Created ID: ${auctionId}`);

    const buyers = [];
    let values = [];
    let queryParams = [];
    for (let i = 0; i < 100; i++) {
        values.push(`($${i*2 + 1}, 'hash', $${i*2 + 2}, ARRAY['buyer'], 'buyer')`);
        queryParams.push(`buyer_${suffix}_${i}@test.k6.com`, `VU ${i}`);
    }
    
    const buyersRes = await client.query(`
        INSERT INTO users (email, password_hash, display_name, roles, active_role) 
        VALUES ${values.join(',')} RETURNING id, email
    `, queryParams);

    buyersRes.rows.forEach(buyer => {
        const token = jwt.sign({ sub: buyer.id, email: buyer.email, roles: ['buyer'] }, JWT_SECRET, { expiresIn: '1h' });
        buyers.push({ token });
    });
    
    console.log('✅ 100 Virtual Users created with JWTs.');

    const data = {
        auctionId,
        users: buyers
    };

    fs.writeFileSync(__dirname + '/k6_data.json', JSON.stringify(data, null, 2));
    console.log(`\n💾 Test data written to server/tests/k6_data.json successfully!`);
  } catch(err) {
      console.error(err);
  } finally {
      client.release();
      await pool.end();
  }
}

setupTestData();
