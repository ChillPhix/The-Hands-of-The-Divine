-- ============================================
-- THE HANDS OF THE DIVINE — Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- World state: stores the entire world as a compressed JSON blob
CREATE TABLE world_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  seed INTEGER NOT NULL DEFAULT 42,
  tick_count BIGINT NOT NULL DEFAULT 0,
  last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  world_data TEXT, -- compressed world chunk references
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- World chunks: the 300x300 map split into 30x30 chunks (100 chunks total)
-- Each chunk stores its tile data as JSON
CREATE TABLE world_chunks (
  chunk_id TEXT PRIMARY KEY, -- format: "cx_cy" e.g. "0_0", "1_0"
  tiles JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Religions created by players
CREATE TABLE religions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol_data TEXT NOT NULL, -- 16x16 pixel grid as JSON
  color TEXT NOT NULL,
  traits TEXT[] NOT NULL DEFAULT '{}',
  creator_name TEXT,
  divine_power REAL NOT NULL DEFAULT 100,
  follower_count INTEGER NOT NULL DEFAULT 0,
  territory_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Holy sites placed by gods
CREATE TABLE holy_sites (
  id TEXT PRIMARY KEY,
  religion_id TEXT REFERENCES religions(id) ON DELETE CASCADE,
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  site_type TEXT NOT NULL DEFAULT 'shrine', -- shrine, temple, cathedral
  power REAL NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- World event log
CREATE TABLE world_events (
  id BIGSERIAL PRIMARY KEY,
  tick BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  religion_id TEXT,
  description TEXT NOT NULL,
  tile_x INTEGER,
  tile_y INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast event queries
CREATE INDEX idx_events_tick ON world_events(tick DESC);
CREATE INDEX idx_events_religion ON world_events(religion_id);

-- Initialize the world state row
INSERT INTO world_state (id, seed, tick_count, last_tick_at)
VALUES ('main', 42, 0, NOW());

-- Enable Row Level Security but allow anon access (public game)
ALTER TABLE world_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE religions ENABLE ROW LEVEL SECURITY;
ALTER TABLE holy_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_events ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations for anon (public game)
CREATE POLICY "Allow all on world_state" ON world_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on world_chunks" ON world_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on religions" ON religions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on holy_sites" ON holy_sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on world_events" ON world_events FOR ALL USING (true) WITH CHECK (true);
