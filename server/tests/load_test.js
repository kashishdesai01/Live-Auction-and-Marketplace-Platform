require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Ensure we are connecting to the local database
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const API_URL = 'http://localhost:5001/api';

async function runConcurrencyTest() {
  const client = await pool.connect();
  try {
    console.log('==================================================');
    console.log('🚀 BIDVAULT LOAD TEST: CONCURRENT BIDDING RACE CONDITION');
    console.log('==================================================\n');

    console.log('1️⃣  Setting up Test Data in PostgreSQL...');
    
    // Create random suffix to avoid unique constraint errors across test runs
    const suffix = Math.floor(Math.random() * 1000000);

    // 1. Create a Seller
    const sellerRes = await client.query(`
      INSERT INTO users (email, password_hash, display_name, roles, active_role) 
      VALUES ($1, 'hash', 'Test Seller', ARRAY['seller'], 'seller') RETURNING id
    `, [`seller_${suffix}@test.com`]);
    const sellerId = sellerRes.rows[0].id;

    // 2. Create an Item
    const itemRes = await client.query(`
      INSERT INTO items (seller_id, title, description, starting_price, condition)
      VALUES ($1, 'Test Load Item (Charizard)', 'Testing locks', 10.00, 'new') RETURNING id
    `, [sellerId]);
    const itemId = itemRes.rows[0].id;

    // 3. Create a Live Auction via direct DB insert
    const startTime = new Date();
    const endTime = new Date(Date.now() + 1000 * 60 * 60); // Ends in 1 hour
    const auctionRes = await client.query(`
      INSERT INTO auctions (item_id, start_time, end_time, current_price, bid_increment, status)
      VALUES ($1, $2, $3, 10.00, 1.00, 'live') RETURNING id
    `, [itemId, startTime, endTime]);
    const auctionId = auctionRes.rows[0].id;

    console.log(`   ✅ Created Live Auction ID: ${auctionId} (Current Price: $10.00)`);

    // 4. Create 100 Dummy Buyers
    console.log('\n2️⃣  Creating 100 concurrent Virtual Buyers...');
    const buyers = [];
    
    // We'll write them in bulk for speed
    let values = [];
    let queryParams = [];
    for (let i = 0; i < 100; i++) {
        values.push(`($${i*2 + 1}, 'hash', $${i*2 + 2}, ARRAY['buyer'], 'buyer')`);
        queryParams.push(`buyer_${suffix}_${i}@test.com`, `Virtual Buyer ${i}`);
    }
    
    const buyersRes = await client.query(`
        INSERT INTO users (email, password_hash, display_name, roles, active_role) 
        VALUES ${values.join(',')} RETURNING id, email
    `, queryParams);

    // Assign roles and generate JWTs

    buyersRes.rows.forEach(buyer => {
        const token = jwt.sign({ sub: buyer.id, email: buyer.email, roles: ['buyer'] }, JWT_SECRET, { expiresIn: '1h' });
        buyers.push({ id: buyer.id, token });
    });
    console.log(`   ✅ 100 Buyers generated with valid JWT access tokens.`);


    // 5. Fire the Bids (The actual Load Test)
    console.log('\n3️⃣  Executing Load Test...');
    console.log(`   🔥 Firing 100 simultaneous POST requests to place an $11.00 bid...`);
    console.log(`   (If our database locks are broken, multiple people will win the $11.00 bid)`);
    
    const startTimeMs = Date.now();
    const targetBidAmount = 11.00;
    const crypto = require('crypto');

    // Map all 100 buyers to a pending fetch promise so they execute concurrently
    const requests = buyers.map(buyer => 
        fetch(`${API_URL}/auctions/${auctionId}/bid`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${buyer.token}`
            },
            body: JSON.stringify({ 
                amount: targetBidAmount,
                idempotency_key: crypto.randomUUID()
            })
        }).then(async res => {
            const body = await res.json().catch(() => ({}));
            return { status: res.status, body };
        }).catch(err => ({ status: 500, error: err.message }))
    );

    // Wait for all 100 network requests to finish
    const responses = await Promise.all(requests);
    const duration = Date.now() - startTimeMs;

    console.log(`   ⏱️  All 100 requests completed in ${duration}ms!`);

    // 6. Analyze the Results
    console.log('\n==================================================');
    console.log('📊 TEST RESULTS');
    console.log('==================================================');
    
    const successCount = responses.filter(r => r.status === 200).length;
    const failCount = responses.filter(r => r.status !== 200).length;
    
    console.log(`Successful Bids (HTTP 200): ${successCount}`);
    console.log(`Rejected Bids (HTTP 400/500): ${failCount}`);
    
    const reasonCounts = {};
    responses.filter(r => r.status !== 200).forEach(r => {
        let msg = r.body?.message || r.body?.error || r.error || 'Unknown Error';
        if (typeof msg === 'object') msg = JSON.stringify(msg);
        reasonCounts[msg] = (reasonCounts[msg] || 0) + 1;
    });
    console.log('\nRejection Breakdown:');
    console.table(reasonCounts);

    // 7. Verify Data Integrity
    const finalAuction = await client.query(`SELECT current_price FROM auctions WHERE id = $1`, [auctionId]);
    const bidCountRes = await client.query(`SELECT COUNT(*) as count FROM bids WHERE auction_id = $1`, [auctionId]);
    const actualBidCount = parseInt(bidCountRes.rows[0].count);
    
    console.log(`\nFinal Database State:`);
    console.log(`- Current Price: $${finalAuction.rows[0].current_price} (Expected: $11.00)`);
    console.log(`- Total Bids Recorded: ${actualBidCount} (Expected: 1)`);
    
    if (successCount === 1 && parseFloat(finalAuction.rows[0].current_price) === 11.00 && actualBidCount === 1) {
        console.log(`\n🏆 ACID COMPLIANCE PASSED!`);
        console.log(`   Our row-level pessimistic locking successfully prevented a race condition.`);
        console.log(`   Despite 100 requests hitting the API at the exact same millisecond,`);
        console.log(`   PostgreSQL serialized the transactions, accepted the very first one,`);
        console.log(`   and correctly rejected the other 99 because the price had updated.`);
    } else {
        console.log(`\n🚨 FAIL! RACE CONDITION DETECTED!`);
        console.log(`   The state of the database is corrupted or multiple bids succeeded for the same amount!`);
    }

  } catch(err) {
      console.error("\n❌ Test Script Crashed:", err);
  } finally {
      client.release();
      await pool.end();
  }
}

runConcurrencyTest();
