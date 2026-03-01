-- 004_auctions.sql: Auctions and bids
CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  current_price NUMERIC(12,2) NOT NULL,
  bid_increment NUMERIC(12,2) NOT NULL DEFAULT 1.00,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended')),
  winner_id UUID REFERENCES users(id),
  final_price NUMERIC(12,2),
  viewer_count INT DEFAULT 0,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auctions_status_end ON auctions(status, end_time);
CREATE INDEX idx_auctions_item ON auctions(item_id);
CREATE INDEX idx_auctions_live ON auctions(status, start_time) WHERE status = 'live';

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id),
  bidder_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','outbid','won')),
  idempotency_key UUID UNIQUE NOT NULL
);

CREATE INDEX idx_bids_auction_amount ON bids(auction_id, amount DESC);
CREATE INDEX idx_bids_bidder ON bids(bidder_id, placed_at DESC);
