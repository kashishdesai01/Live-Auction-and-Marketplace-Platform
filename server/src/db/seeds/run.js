require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const pool = require('../../config/db');

const categories = [
  { name: 'Trading Cards', slug: 'trading-cards', icon_url: '🃏', display_order: 1, children: [
    { name: 'Pokemon', slug: 'pokemon' },
    { name: 'Magic: The Gathering', slug: 'mtg' },
    { name: 'Sports Cards', slug: 'sports-cards' },
    { name: 'Yu-Gi-Oh', slug: 'yugioh' },
  ]},
  { name: 'Collectibles', slug: 'collectibles', icon_url: '🏺', display_order: 2, children: [
    { name: 'Comic Books', slug: 'comic-books' },
    { name: 'Coins', slug: 'coins' },
    { name: 'Stamps', slug: 'stamps' },
    { name: 'Action Figures', slug: 'action-figures' },
    { name: 'Vintage Toys', slug: 'vintage-toys' },
  ]},
  { name: 'Electronics', slug: 'electronics', icon_url: '💻', display_order: 3, children: [
    { name: 'Smartphones', slug: 'smartphones' },
    { name: 'Laptops', slug: 'laptops' },
    { name: 'Gaming', slug: 'gaming' },
    { name: 'Audio', slug: 'audio' },
    { name: 'Cameras', slug: 'cameras' },
  ]},
  { name: 'Fashion', slug: 'fashion', icon_url: '👟', display_order: 4, children: [
    { name: 'Sneakers', slug: 'sneakers' },
    { name: 'Streetwear', slug: 'streetwear' },
    { name: 'Vintage', slug: 'fashion-vintage' },
    { name: 'Accessories', slug: 'accessories' },
    { name: 'Luxury', slug: 'luxury-fashion' },
  ]},
  { name: 'Art & Decor', slug: 'art-decor', icon_url: '🎨', display_order: 5, children: [
    { name: 'Prints', slug: 'prints' },
    { name: 'Paintings', slug: 'paintings' },
    { name: 'Sculptures', slug: 'sculptures' },
    { name: 'Posters', slug: 'posters' },
    { name: 'Photography', slug: 'photography' },
  ]},
  { name: 'Books & Media', slug: 'books-media', icon_url: '📚', display_order: 6, children: [
    { name: 'First Editions', slug: 'first-editions' },
    { name: 'Vinyl Records', slug: 'vinyl-records' },
    { name: 'Video Games', slug: 'video-games' },
    { name: 'Movies', slug: 'movies' },
  ]},
  { name: 'Sports & Outdoors', slug: 'sports-outdoors', icon_url: '⚽', display_order: 7, children: [
    { name: 'Memorabilia', slug: 'memorabilia' },
    { name: 'Equipment', slug: 'sports-equipment' },
    { name: 'Jerseys', slug: 'jerseys' },
    { name: 'Signed Items', slug: 'signed-items' },
  ]},
  { name: 'Jewelry & Watches', slug: 'jewelry-watches', icon_url: '💎', display_order: 8, children: [
    { name: 'Fine Jewelry', slug: 'fine-jewelry' },
    { name: 'Luxury Watches', slug: 'luxury-watches' },
    { name: 'Vintage Jewelry', slug: 'vintage-jewelry' },
    { name: 'Handmade', slug: 'handmade-jewelry' },
  ]},
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing (idempotent)
    await client.query('DELETE FROM categories');

    for (const cat of categories) {
      const { rows } = await client.query(
        'INSERT INTO categories (name, slug, icon_url, display_order) VALUES ($1,$2,$3,$4) RETURNING id',
        [cat.name, cat.slug, cat.icon_url, cat.display_order]
      );
      const parentId = rows[0].id;

      for (const child of cat.children || []) {
        await client.query(
          'INSERT INTO categories (name, slug, parent_id) VALUES ($1,$2,$3)',
          [child.name, child.slug, parentId]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ Categories seeded');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
