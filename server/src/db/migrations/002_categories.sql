-- 002_categories.sql: Category hierarchy and user interests
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  parent_id INT REFERENCES categories(id),
  icon_url TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_category_interests (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE CASCADE,
  affinity_score FLOAT DEFAULT 10.0,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, category_id)
);

CREATE INDEX idx_uci_user_score ON user_category_interests(user_id, affinity_score DESC);

CREATE TABLE seller_category_specializations (
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE CASCADE,
  item_count INT DEFAULT 0,
  avg_sale_price NUMERIC(12,2) DEFAULT 0,
  PRIMARY KEY (seller_id, category_id)
);
