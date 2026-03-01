require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrate() {
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT id FROM _migrations WHERE filename = $1', [file]
    );
    if (rows.length > 0) {
      console.log(`  ⏭  Skipping: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`  ✅ Applied: ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`  ❌ Failed: ${file}`, err.message);
      process.exit(1);
    }
  }

  console.log('✅ All migrations complete');
  process.exit(0);
}

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
