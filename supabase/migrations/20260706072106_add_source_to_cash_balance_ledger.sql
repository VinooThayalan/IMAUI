ALTER TABLE cash_balance_ledger ADD COLUMN IF NOT EXISTS source text DEFAULT 'Manual';

COMMENT ON COLUMN cash_balance_ledger.source IS 'Origin of this entry: Manual, Dividend, Trade';