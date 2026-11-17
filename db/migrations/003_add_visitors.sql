-- Privacy-preserving unique visitor tracking (stores only salted HMAC-SHA256 IP hashes)
CREATE TABLE IF NOT EXISTS visitors (
  ip_hash TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitors_last_seen_at
  ON visitors (last_seen_at DESC);

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
