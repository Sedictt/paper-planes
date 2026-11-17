-- Paper Planes initial PostgreSQL schema (Supabase / Neon compatible)
-- Safe to run multiple times (idempotent DDL).

CREATE SEQUENCE IF NOT EXISTS planes_number_seq START WITH 200 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS planes (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL DEFAULT nextval('planes_number_seq'),
  author_id UUID NULL, -- Future-proofed for Supabase Auth / accounts
  title TEXT NULL,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 3 AND 320),
  biome TEXT NOT NULL DEFAULT 'Downtown Rooftops',
  time_of_day TEXT NOT NULL CHECK (time_of_day IN ('dawn', 'morning', 'afternoon', 'dusk', 'evening', 'midnight')),
  paper_tint TEXT NOT NULL CHECK (paper_tint IN ('cream', 'rose', 'sky', 'sage', 'gold')),
  stamp TEXT NOT NULL DEFAULT 'AIRMAIL',
  country_code CHAR(2) NOT NULL DEFAULT 'PH',
  reads INTEGER NOT NULL DEFAULT 1 CHECK (reads >= 0),
  distance_km NUMERIC(8, 1) NOT NULL DEFAULT 0.4 CHECK (distance_km >= 0),
  flags INTEGER NOT NULL DEFAULT 0 CHECK (flags >= 0),
  shadow_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  plane_id TEXT NOT NULL REFERENCES planes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count >= 0),
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS plane_flags (
  plane_id TEXT NOT NULL REFERENCES planes(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plane_id, ip_hash)
);

-- Hot query index: visible planes sorted newest-first
CREATE INDEX IF NOT EXISTS idx_planes_visible_created_at
  ON planes (created_at DESC, id DESC)
  WHERE flags < 3 AND shadow_blocked = FALSE;

-- Hot query index: visible planes filtered by country, sorted newest-first
CREATE INDEX IF NOT EXISTS idx_planes_visible_country_created_at
  ON planes (country_code, created_at DESC, id DESC)
  WHERE flags < 3 AND shadow_blocked = FALSE;

-- Future index for user-owned planes when accounts are added
CREATE INDEX IF NOT EXISTS idx_planes_author_id
  ON planes (author_id)
  WHERE author_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
  ON rate_limits (reset_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys (created_at);

-- Lock down direct PostgREST / anon access on Supabase; backend connects with privileged role
ALTER TABLE planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE plane_flags ENABLE ROW LEVEL SECURITY;
