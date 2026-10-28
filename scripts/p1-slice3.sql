-- P1 slice 3: corporate actions and one buyback flow. Additive and idempotent.

CREATE TABLE IF NOT EXISTS corporate_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type text NOT NULL,
  action_date date NOT NULL,
  ratio_new numeric(12,4) NOT NULL DEFAULT 1,
  ratio_old numeric(12,4) NOT NULL DEFAULT 1,
  amount numeric(20,4) NOT NULL DEFAULT 0,
  tds numeric(20,4) NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actions_user_idx ON corporate_actions (user_id);
CREATE INDEX IF NOT EXISTS actions_asset_idx ON corporate_actions (asset_id);

-- A bonus event owns the zero-cost lot it created; reversing the event removes the lot.
ALTER TABLE buy_lots ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES corporate_actions(id) ON DELETE CASCADE;

-- Shares tendered in a buyback; qty on the sale is the accepted part.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tendered_qty numeric(24,8);

-- Buyback is no longer a Misc entry type. A hand-entered one (shares bought back in a private deal) becomes a
-- plain Misc profit with the same net result: (proceeds - cost) - brokerage, tax settings unchanged.
UPDATE misc_entries SET asset_type = 'other', amount = amount - cost, cost = 0 WHERE asset_type = 'buyback';
