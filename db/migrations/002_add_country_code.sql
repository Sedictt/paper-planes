-- Add country_code to planes for region-based filtering (backfills existing rows to 'PH')
ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS country_code CHAR(2) NOT NULL DEFAULT 'PH';

CREATE INDEX IF NOT EXISTS idx_planes_visible_country_created_at
  ON planes (country_code, created_at DESC, id DESC)
  WHERE flags < 3 AND shadow_blocked = FALSE;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys (created_at);
