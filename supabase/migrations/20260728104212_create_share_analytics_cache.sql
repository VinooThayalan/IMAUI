/*
# Create Share Analytics Cache Table

1. New Tables
   - `share_analytics_cache` — stores computed share analytics rows so the report
     can be served from cache instead of recomputing from source tables every time.
     Columns:
     - `id` (uuid PK) — unique row id
     - `entity_id` (uuid) — entity this row belongs to
     - `share_id` (uuid) — share this row belongs to
     - `entity_name` (text) — entity name snapshot
     - `share_ticker` (text) — share ticker snapshot
     - `share_name` (text) — share name snapshot
     - `market_price` (numeric) — market price at compute time
     - `market_price_date` (date, nullable) — date of that market price
     - `cds_accounts` (text[]) — CDS accounts snapshot
     - `brokerage_fee_rate` (numeric) — fee rate snapshot
     - `row_id` (text) — original computed row identifier
     - `row_type` (text) — 'opening' | 'buy' | 'sell' | 'dividend' | 'scrip'
     - `note_type` (text) — note type label
     - `trade_date` (date, nullable) — trade date
     - `no_of_shares` (numeric) — shares in this event
     - `price_avg` (numeric, nullable) — average price
     - `gross_amount` (numeric) — gross amount
     - `net_amount` (numeric) — net amount from note
     - `cds_account` (text, nullable) — single CDS account for this row
     - `purchase_cost` (numeric) — computed purchase cost
     - `sale_value` (numeric) — computed sale value
     - `dividend` (numeric) — computed dividend amount
     - `share_cum_bal` (numeric) — cumulative share balance after this row
     - `av_cost` (numeric) — average cost after this row
     - `av_price` (numeric) — average price after this row
     - `cum_purchase_cost` (numeric) — cumulative purchase cost
     - `cum_sale_value` (numeric) — cumulative sale value
     - `cum_dividend` (numeric) — cumulative dividend
     - `cum_surplus` (numeric) — cumulative realized surplus
     - `market_value` (numeric) — market value at this point
     - `cash_flow` (numeric) — cash flow for this row
     - `total_surplus` (numeric) — total surplus including market value
     - `source_hash` (text) — hash of source-data fingerprints; all rows from one
       compute run share the same hash
     - `computed_at` (timestamptz) — when this batch was computed

2. Security
   - Enable RLS on `share_analytics_cache`.
   - Authenticated users can SELECT, INSERT, UPDATE, DELETE (shared analytics,
     no per-user ownership — all authenticated users see the same cached report).

3. Indexes
   - Index on `entity_id` for entity filtering
   - Index on `source_hash` for quick cache-hit checks
   - Index on `computed_at` for ordering

4. Important Notes
   - On each report open, the frontend computes a source hash from the latest
     `updated_at` timestamps of all source tables. If the hash matches the most
     recent cached batch, rows are read directly from this table. If not, the
     report is recomputed from source tables and the new rows are inserted here,
     replacing the previous batch.
   - Old cache rows are deleted before inserting a new batch to keep the table
     from growing unbounded.
*/

CREATE TABLE IF NOT EXISTS share_analytics_cache (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           text   NOT NULL,
  share_id            text   NOT NULL,
  entity_name         text   NOT NULL DEFAULT '',
  share_ticker        text   NOT NULL DEFAULT '',
  share_name          text   NOT NULL DEFAULT '',
  market_price        numeric(20, 4) NOT NULL DEFAULT 0,
  market_price_date   date,
  cds_accounts        text[] NOT NULL DEFAULT '{}',
  brokerage_fee_rate  numeric(10, 4) NOT NULL DEFAULT 0,
  row_id              text   NOT NULL,
  row_type            text   NOT NULL,
  note_type           text   NOT NULL DEFAULT '',
  trade_date          date,
  no_of_shares        numeric(20, 4) NOT NULL DEFAULT 0,
  price_avg           numeric(20, 4),
  gross_amount        numeric(20, 4) NOT NULL DEFAULT 0,
  net_amount          numeric(20, 4) NOT NULL DEFAULT 0,
  cds_account         text,
  purchase_cost       numeric(20, 4) NOT NULL DEFAULT 0,
  sale_value          numeric(20, 4) NOT NULL DEFAULT 0,
  dividend            numeric(20, 4) NOT NULL DEFAULT 0,
  share_cum_bal       numeric(20, 4) NOT NULL DEFAULT 0,
  av_cost             numeric(20, 4) NOT NULL DEFAULT 0,
  av_price            numeric(20, 4) NOT NULL DEFAULT 0,
  cum_purchase_cost   numeric(20, 4) NOT NULL DEFAULT 0,
  cum_sale_value      numeric(20, 4) NOT NULL DEFAULT 0,
  cum_dividend        numeric(20, 4) NOT NULL DEFAULT 0,
  cum_surplus         numeric(20, 4) NOT NULL DEFAULT 0,
  market_value        numeric(20, 4) NOT NULL DEFAULT 0,
  cash_flow           numeric(20, 4) NOT NULL DEFAULT 0,
  total_surplus       numeric(20, 4) NOT NULL DEFAULT 0,
  source_hash         text   NOT NULL,
  computed_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE share_analytics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_analytics_cache" ON share_analytics_cache;
CREATE POLICY "select_analytics_cache"
  ON share_analytics_cache FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_analytics_cache" ON share_analytics_cache;
CREATE POLICY "insert_analytics_cache"
  ON share_analytics_cache FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_analytics_cache" ON share_analytics_cache;
CREATE POLICY "update_analytics_cache"
  ON share_analytics_cache FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_analytics_cache" ON share_analytics_cache;
CREATE POLICY "delete_analytics_cache"
  ON share_analytics_cache FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_entity_id
  ON share_analytics_cache(entity_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_source_hash
  ON share_analytics_cache(source_hash);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_computed_at
  ON share_analytics_cache(computed_at DESC);