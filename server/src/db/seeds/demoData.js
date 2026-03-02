require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../../config/db');

const DEMO_PASSWORD = 'password123';
const BUYER_COUNT = 80;
const SELLER_COUNT = 18;
const LIVE_AUCTIONS = 24;
const SCHEDULED_AUCTIONS = 18;
const ENDED_AUCTIONS = 14;
const ACTIVE_NO_AUCTION_ITEMS = 20;
const DRAFT_ITEMS = 10;

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Casey', 'Logan',
  'Quinn', 'Cameron', 'Skyler', 'Parker', 'Drew', 'Rowan', 'Elliot', 'Kai',
  'Micah', 'Sage', 'Charlie', 'Reese', 'Sydney', 'Dakota', 'Milan', 'Noel',
];

const LAST_NAMES = [
  'Parker', 'Wright', 'Carter', 'Brooks', 'Hayes', 'Nguyen', 'Patel', 'Kim',
  'Jackson', 'Martinez', 'Singh', 'Hernandez', 'Morris', 'Reed', 'Bennett',
  'Shaw', 'Rivera', 'Price', 'Ward', 'Ellis', 'Cooper', 'Adams', 'Diaz',
];

const STORE_PREFIXES = [
  'Vault', 'Empire', 'Supply', 'Collective', 'Archive', 'Corner', 'House',
  'Trades', 'Gallery', 'Depot', 'Market', 'Club',
];

const ITEM_ADJECTIVES = [
  'Rare', 'Vintage', 'Limited', 'Signed', 'Premium', 'Collector Grade',
  'Factory Sealed', 'Mint', 'Classic', 'Edition',
];

const ITEM_OBJECTS = [
  'Card Set', 'Sneaker Pair', 'Wristwatch', 'Retro Console', 'Comic Issue',
  'Vinyl Pressing', 'Camera Lens', 'Designer Jacket', 'Trading Card', 'Art Print',
  'Figure', 'Poster',
];

const ITEM_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

const NOTIFICATION_TYPES = ['outbid', 'auction_ending', 'won', 'new_listing', 'order_update'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randMoney(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function pickMany(arr, count) {
  const copy = [...arr];
  const out = [];
  const target = Math.min(count, copy.length);
  for (let i = 0; i < target; i += 1) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function makeImageUrls(seed) {
  return [
    `https://picsum.photos/seed/${seed}-a/1200/900`,
    `https://picsum.photos/seed/${seed}-b/1200/900`,
  ];
}

function makeDisplayName(index) {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${index}`;
}

function makeStorefront(index) {
  return `${pick(FIRST_NAMES)}'s ${pick(STORE_PREFIXES)} ${index}`;
}

function randomAddress(index) {
  return {
    line1: `${randInt(100, 9999)} Market St #${index}`,
    city: pick(['Austin', 'Seattle', 'Denver', 'San Diego', 'Chicago', 'Miami', 'Phoenix']),
    state: pick(['CA', 'TX', 'WA', 'CO', 'IL', 'FL', 'AZ']),
    postal_code: `${randInt(10000, 99999)}`,
    country: 'US',
  };
}

async function insertUser(client, passwordHash, { email, displayName, roles, activeRole, location = null }) {
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, display_name, roles, active_role, location, is_verified, last_login)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW() - ($7 || ' hours')::interval)
     RETURNING id, email, display_name`,
    [email, passwordHash, displayName, roles, activeRole, location, `${randInt(1, 240)}`]
  );
  return rows[0];
}

async function seedDemoData() {
  const client = await pool.connect();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  try {
    console.log('Seeding realistic demo data...');
    await client.query('BEGIN');

    await client.query(`
      TRUNCATE TABLE
        watchlist,
        notifications,
        saved_searches,
        orders,
        bids,
        auctions,
        items,
        user_category_interests,
        seller_category_specializations,
        buyer_profiles,
        seller_profiles,
        users
      RESTART IDENTITY CASCADE
    `);

    const { rows: categories } = await client.query(
      `SELECT id, name FROM categories WHERE parent_id IS NOT NULL AND is_active = TRUE ORDER BY id`
    );
    if (categories.length === 0) {
      throw new Error('No categories found. Run: node src/db/seeds/run.js');
    }

    const { rows: orderCols } = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders'`
    );
    const orderColSet = new Set(orderCols.map((r) => r.column_name));
    const orderStatusColumn = orderColSet.has('payment_status') ? 'payment_status' : 'status';
    const hasStripePaymentIntentId = orderColSet.has('stripe_payment_intent_id');

    const buyers = [];
    const sellers = [];
    const buyerSpend = new Map();
    const buyerWins = new Map();

    // Fixed demo users
    const demoBuyer = await insertUser(client, passwordHash, {
      email: 'buyer@example.com',
      displayName: 'Alice Buyer',
      roles: ['buyer'],
      activeRole: 'buyer',
      location: 'Austin, TX',
    });
    buyers.push(demoBuyer);

    const demoSeller = await insertUser(client, passwordHash, {
      email: 'seller@example.com',
      displayName: 'Bob Seller',
      roles: ['seller', 'buyer'],
      activeRole: 'seller',
      location: 'Seattle, WA',
    });
    sellers.push(demoSeller);

    await client.query(
      `INSERT INTO buyer_profiles (user_id, shipping_address, stripe_customer_id, onboarding_completed)
       VALUES ($1, $2::jsonb, $3, TRUE)`,
      [demoBuyer.id, JSON.stringify(randomAddress(1)), 'cus_demo_buyer_001']
    );

    await client.query(
      `INSERT INTO seller_profiles
       (user_id, storefront_name, description, stripe_account_id, stripe_onboarding_complete, is_verified_seller, avg_rating, total_sales, total_revenue)
       VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, 0, 0)`,
      [demoSeller.id, "Bob's Vintage Vault", 'Rare collectibles, cards, and graded inventory.', 'acct_demo_seller_001', 4.9]
    );

    // Additional sellers
    for (let i = 2; i <= SELLER_COUNT; i += 1) {
      const user = await insertUser(client, passwordHash, {
        email: `seller${String(i).padStart(2, '0')}@example.com`,
        displayName: makeDisplayName(i),
        roles: i % 4 === 0 ? ['seller', 'buyer'] : ['seller'],
        activeRole: 'seller',
        location: pick(['Los Angeles, CA', 'Portland, OR', 'Nashville, TN', 'Boston, MA']),
      });
      sellers.push(user);

      await client.query(
        `INSERT INTO seller_profiles
         (user_id, storefront_name, description, stripe_account_id, stripe_onboarding_complete, is_verified_seller, avg_rating, total_sales, total_revenue)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6, 0, 0)`,
        [
          user.id,
          makeStorefront(i),
          `${pick(['Cards', 'Luxury', 'Vintage', 'Streetwear', 'Electronics'])} specialist with weekly live auctions.`,
          `acct_demo_seller_${String(i).padStart(3, '0')}`,
          i % 3 !== 0,
          parseFloat((randInt(42, 50) / 10).toFixed(2)),
        ]
      );
    }

    // Additional buyers
    for (let i = 2; i <= BUYER_COUNT; i += 1) {
      const user = await insertUser(client, passwordHash, {
        email: `buyer${String(i).padStart(2, '0')}@example.com`,
        displayName: makeDisplayName(i + 100),
        roles: ['buyer'],
        activeRole: 'buyer',
        location: pick(['New York, NY', 'Dallas, TX', 'San Jose, CA', 'Atlanta, GA', 'Chicago, IL']),
      });
      buyers.push(user);

      const hasSavedCard = i % 5 !== 0;
      await client.query(
        `INSERT INTO buyer_profiles
         (user_id, shipping_address, stripe_customer_id, onboarding_completed)
         VALUES ($1, $2::jsonb, $3, TRUE)`,
        [user.id, JSON.stringify(randomAddress(i)), hasSavedCard ? `cus_demo_${String(i).padStart(3, '0')}` : null]
      );
    }

    // Buyer interests
    for (const buyer of buyers) {
      const interested = pickMany(categories, randInt(3, 6));
      for (const cat of interested) {
        await client.query(
          `INSERT INTO user_category_interests (user_id, category_id, affinity_score, selected_at, last_updated)
           VALUES ($1, $2, $3, NOW() - ($4 || ' days')::interval, NOW() - ($4 || ' days')::interval)`,
          [buyer.id, cat.id, randMoney(8, 35), `${randInt(0, 20)}`]
        );
      }
    }

    // Create items
    const liveItems = [];
    const scheduledItems = [];
    const endedItems = [];
    const activeNoAuctionItems = [];
    const draftItems = [];

    let itemCounter = 1;
    const totalItems = LIVE_AUCTIONS + SCHEDULED_AUCTIONS + ENDED_AUCTIONS + ACTIVE_NO_AUCTION_ITEMS + DRAFT_ITEMS;

    for (let i = 0; i < totalItems; i += 1) {
      const bucket =
        i < LIVE_AUCTIONS ? 'live' :
        i < LIVE_AUCTIONS + SCHEDULED_AUCTIONS ? 'scheduled' :
        i < LIVE_AUCTIONS + SCHEDULED_AUCTIONS + ENDED_AUCTIONS ? 'ended' :
        i < LIVE_AUCTIONS + SCHEDULED_AUCTIONS + ENDED_AUCTIONS + ACTIVE_NO_AUCTION_ITEMS ? 'active_no_auction' :
        'draft';

      const seller = sellers[i % sellers.length];
      const category = pick(categories);
      const basePrice = randMoney(40, 4000);
      const title = `${pick(ITEM_ADJECTIVES)} ${category.name} ${pick(ITEM_OBJECTS)} #${itemCounter}`;
      const description = `${title} with verified condition notes and fast shipping from a top seller.`;
      const status = bucket === 'ended' ? 'sold' : bucket === 'draft' ? 'draft' : 'active';

      const { rows } = await client.query(
        `INSERT INTO items
         (seller_id, title, description, category_id, condition, starting_price, reserve_price, image_urls, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW() - ($10 || ' days')::interval, NOW())
         RETURNING id, seller_id, title, category_id, starting_price`,
        [
          seller.id,
          title,
          description,
          category.id,
          pick(ITEM_CONDITIONS),
          basePrice,
          Math.random() < 0.35 ? parseFloat((basePrice * randMoney(1.05, 1.4)).toFixed(2)) : null,
          makeImageUrls(`item-${itemCounter}`),
          status,
          `${randInt(0, 28)}`,
        ]
      );

      const item = rows[0];
      if (bucket === 'live') liveItems.push(item);
      if (bucket === 'scheduled') scheduledItems.push(item);
      if (bucket === 'ended') endedItems.push(item);
      if (bucket === 'active_no_auction') activeNoAuctionItems.push(item);
      if (bucket === 'draft') draftItems.push(item);
      itemCounter += 1;
    }

    const now = Date.now();
    const auctionIds = { live: [], scheduled: [], ended: [] };

    // Live auctions + bids
    for (const item of liveItems) {
      const startTime = new Date(now - randInt(20, 240) * 60 * 1000);
      const endTime = new Date(now + randInt(45, 720) * 60 * 1000);
      const bidIncrement = Math.max(1, parseFloat((item.starting_price * 0.02).toFixed(2)));
      const bidsToCreate = randInt(3, 14);
      const bidders = pickMany(buyers, Math.min(bidsToCreate, buyers.length));
      let highest = parseFloat(item.starting_price);

      const { rows: insertedAuctionRows } = await client.query(
        `INSERT INTO auctions
         (item_id, start_time, end_time, current_price, bid_increment, status, viewer_count, version)
         VALUES ($1, $2, $3, $4, $5, 'live', $6, 1)
         RETURNING id`,
        [item.id, startTime, endTime, highest, bidIncrement, randInt(5, 180)]
      );
      const auctionId = insertedAuctionRows[0].id;
      auctionIds.live.push(auctionId);

      for (let i = 0; i < bidders.length; i += 1) {
        highest = parseFloat((highest + bidIncrement + randMoney(0, bidIncrement * 1.3)).toFixed(2));
        await client.query(
          `INSERT INTO bids
           (auction_id, bidder_id, amount, placed_at, status, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            auctionId,
            bidders[i].id,
            highest,
            new Date(startTime.getTime() + randInt(5, Math.max(10, Math.floor((Date.now() - startTime.getTime()) / 1000))) * 1000),
            i === bidders.length - 1 ? 'active' : 'outbid',
            crypto.randomUUID(),
          ]
        );
      }

      await client.query('UPDATE auctions SET current_price = $1 WHERE id = $2', [highest, auctionId]);
    }

    // Scheduled auctions
    for (const item of scheduledItems) {
      const startTime = new Date(now + randInt(20, 48 * 60) * 60 * 1000);
      const endTime = new Date(startTime.getTime() + randInt(90, 18 * 60) * 60 * 1000);
      const bidIncrement = Math.max(1, parseFloat((item.starting_price * 0.02).toFixed(2)));
      const { rows: scheduledRows } = await client.query(
        `INSERT INTO auctions
         (item_id, start_time, end_time, current_price, bid_increment, status, viewer_count, version)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', 0, 1)
         RETURNING id`,
        [item.id, startTime, endTime, item.starting_price, bidIncrement]
      );
      auctionIds.scheduled.push(scheduledRows[0].id);
    }

    // Ended auctions + bids + orders
    for (const item of endedItems) {
      const startTime = new Date(now - randInt(3, 18) * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + randInt(90, 8 * 60) * 60 * 1000);
      const bidIncrement = Math.max(1, parseFloat((item.starting_price * 0.02).toFixed(2)));
      const bidsToCreate = randInt(2, 10);
      const bidders = pickMany(buyers, Math.min(bidsToCreate, buyers.length));

      let highest = parseFloat(item.starting_price);
      let winnerId = null;
      const { rows: endedAuctionRows } = await client.query(
        `INSERT INTO auctions
         (item_id, start_time, end_time, current_price, bid_increment, status, viewer_count, version)
         VALUES ($1, $2, $3, $4, $5, 'ended', $6, 1)
         RETURNING id`,
        [item.id, startTime, endTime, highest, bidIncrement, randInt(0, 35)]
      );
      const auctionId = endedAuctionRows[0].id;
      auctionIds.ended.push(auctionId);

      for (let i = 0; i < bidders.length; i += 1) {
        highest = parseFloat((highest + bidIncrement + randMoney(0, bidIncrement * 1.6)).toFixed(2));
        winnerId = bidders[i].id;
        await client.query(
          `INSERT INTO bids
           (auction_id, bidder_id, amount, placed_at, status, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            auctionId,
            bidders[i].id,
            highest,
            new Date(startTime.getTime() + randInt(5, Math.max(10, Math.floor((endTime.getTime() - startTime.getTime()) / 1000))) * 1000),
            i === bidders.length - 1 ? 'won' : 'outbid',
            crypto.randomUUID(),
          ]
        );
      }

      await client.query(
        `UPDATE auctions
         SET current_price=$1, winner_id=$2, final_price=$3
         WHERE id=$4`,
        [highest, winnerId, highest, auctionId]
      );

      const paymentStatus = pick(['paid', 'paid', 'paid', 'pending', 'failed']);
      const shippingStatus =
        paymentStatus !== 'paid' ? 'pending' :
        pick(['pending', 'shipped', 'delivered']);
      const tracking =
        shippingStatus === 'shipped' || shippingStatus === 'delivered'
          ? `TRK${randInt(1000000, 9999999)}`
          : null;

      const orderColumns = [
        'auction_id',
        'buyer_id',
        'seller_id',
        'amount',
        orderStatusColumn,
        'shipping_status',
        'tracking_number',
        'created_at',
      ];
      const orderValues = [
        auctionId,
        winnerId,
        item.seller_id,
        highest,
        paymentStatus,
        shippingStatus,
        tracking,
        new Date(endTime.getTime() + randInt(5, 180) * 60 * 1000),
      ];

      if (hasStripePaymentIntentId) {
        orderColumns.push('stripe_payment_intent_id');
        orderValues.push(paymentStatus === 'paid' ? `pi_demo_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}` : null);
      }

      const orderPlaceholders = orderColumns.map((_, idx) => `$${idx + 1}`).join(', ');
      await client.query(
        `INSERT INTO orders (${orderColumns.join(', ')}) VALUES (${orderPlaceholders})`,
        orderValues
      );

      buyerWins.set(winnerId, (buyerWins.get(winnerId) || 0) + 1);
      buyerSpend.set(winnerId, (buyerSpend.get(winnerId) || 0) + highest);
    }

    // Watchlist entries for live and scheduled auctions
    for (const auctionId of [...auctionIds.live, ...auctionIds.scheduled]) {
      const interestedBuyers = pickMany(buyers, randInt(6, 18));
      for (const buyer of interestedBuyers) {
        await client.query(
          `INSERT INTO watchlist (user_id, auction_id, added_at)
           VALUES ($1, $2, NOW() - ($3 || ' hours')::interval)
           ON CONFLICT DO NOTHING`,
          [buyer.id, auctionId, `${randInt(1, 72)}`]
        );
      }
    }

    // Notifications
    const notificationUsers = pickMany(buyers, Math.min(45, buyers.length));
    for (const user of notificationUsers) {
      const count = randInt(1, 4);
      for (let i = 0; i < count; i += 1) {
        const type = pick(NOTIFICATION_TYPES);
        const payload = {
          auction_id: pick([...auctionIds.live, ...auctionIds.scheduled, ...auctionIds.ended]),
          message: `${type.replace('_', ' ')} update`,
        };
        await client.query(
          `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
           VALUES ($1, $2, $3::jsonb, $4, NOW() - ($5 || ' hours')::interval)`,
          [user.id, type, JSON.stringify(payload), Math.random() < 0.35, `${randInt(1, 120)}`]
        );
      }
    }

    // Update buyer profile totals
    for (const buyer of buyers) {
      await client.query(
        `UPDATE buyer_profiles
         SET total_won = $2,
             total_spent = $3
         WHERE user_id = $1`,
        [
          buyer.id,
          buyerWins.get(buyer.id) || 0,
          parseFloat((buyerSpend.get(buyer.id) || 0).toFixed(2)),
        ]
      );
    }

    // Seller category specialization + metrics
    await client.query(`
      INSERT INTO seller_category_specializations (seller_id, category_id, item_count, avg_sale_price)
      SELECT i.seller_id, i.category_id, COUNT(*)::int, COALESCE(AVG(i.starting_price), 0)::numeric(12,2)
      FROM items i
      WHERE i.category_id IS NOT NULL
      GROUP BY i.seller_id, i.category_id
      ON CONFLICT (seller_id, category_id) DO UPDATE
      SET item_count = EXCLUDED.item_count,
          avg_sale_price = EXCLUDED.avg_sale_price
    `);

    await client.query(`
      UPDATE seller_profiles sp
      SET total_sales = COALESCE(src.total_sales, 0),
          total_revenue = COALESCE(src.total_revenue, 0)
      FROM (
        SELECT o.seller_id,
               COUNT(*) FILTER (WHERE o.${orderStatusColumn} = 'paid')::int AS total_sales,
               COALESCE(SUM(o.amount) FILTER (WHERE o.${orderStatusColumn} = 'paid'), 0)::numeric(12,2) AS total_revenue
        FROM orders o
        GROUP BY o.seller_id
      ) src
      WHERE sp.user_id = src.seller_id
    `);

    await client.query('COMMIT');

    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE roles @> ARRAY['buyer']::text[]) AS buyers,
        (SELECT COUNT(*) FROM users WHERE roles @> ARRAY['seller']::text[]) AS sellers,
        (SELECT COUNT(*) FROM items) AS items,
        (SELECT COUNT(*) FROM items WHERE status = 'active') AS active_items,
        (SELECT COUNT(*) FROM auctions WHERE status = 'live') AS live_auctions,
        (SELECT COUNT(*) FROM auctions WHERE status = 'scheduled') AS scheduled_auctions,
        (SELECT COUNT(*) FROM auctions WHERE status = 'ended') AS ended_auctions,
        (SELECT COUNT(*) FROM bids) AS bids,
        (SELECT COUNT(*) FROM orders) AS orders
    `);

    console.log('✅ Demo seed complete');
    console.table(summary.rows[0]);
    console.log('Demo logins:');
    console.log('  buyer@example.com / password123');
    console.log('  seller@example.com / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Demo seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoData();
