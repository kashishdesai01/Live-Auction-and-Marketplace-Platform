-- 003_items.sql: Item listings
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category_id INT REFERENCES categories(id),
  subcategory_id INT REFERENCES categories(id),
  image_urls TEXT[] DEFAULT '{}',
  condition VARCHAR(20) CHECK (condition IN ('new','like_new','good','fair','poor')),
  starting_price NUMERIC(12,2) NOT NULL CHECK (starting_price > 0),
  reserve_price NUMERIC(12,2),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','active','ended','sold')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_category_status ON items(category_id, status);
CREATE INDEX idx_items_seller ON items(seller_id, status);
CREATE INDEX idx_items_status ON items(status, created_at DESC);

-- Full text search index
ALTER TABLE items ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  ) STORED;

CREATE INDEX idx_items_search ON items USING gin(search_vector);
