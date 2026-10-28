-- P1 slice 1: additive schema changes. Idempotent: safe to run more than once.
-- Nothing is dropped or rewritten. Widening numeric scale keeps every stored value exactly as it was.

ALTER TABLE buy_lots ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'Other';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS user_platforms (
  user_id text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'broker',
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, name)
);

ALTER TABLE buy_lots ALTER COLUMN qty TYPE numeric(24,8);
ALTER TABLE buy_lots ALTER COLUMN unit_price TYPE numeric(24,8);
ALTER TABLE sales ALTER COLUMN qty TYPE numeric(24,8);
ALTER TABLE sales ALTER COLUMN price TYPE numeric(24,8);
ALTER TABLE sale_allocations ALTER COLUMN qty TYPE numeric(24,8);

-- Backfill platform from where each purchase came from. Only rows still on the default are touched.
UPDATE buy_lots SET platform = CASE
  WHEN source LIKE 'zerodha%' OR source = 'kite_sync' THEN 'Zerodha'
  WHEN source LIKE 'groww%' THEN 'Groww'
  ELSE 'Other' END
WHERE platform = 'Other';
