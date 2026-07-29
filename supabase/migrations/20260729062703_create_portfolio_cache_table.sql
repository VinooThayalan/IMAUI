/*
# Create Portfolio Cache Table

1. New Tables
   - `portfolio_cache` — stores computed portfolio report rows so the Portfolio
     page can be served from cache instead of recomputing from source tables.
     The Portfolio page reads per-entity-share holdings from `share_analytics_cache`
     (the last row of each group has the final holdings), then aggregates them into
     summary rows that are stored here.
     Columns:
     - `id` (uuid PK) — unique row id
     - `entity_id` (text) — entity this row belongs to ('all' for all-entities view)
     - `scope` (text) — 'all' or a specific entity id
     - `section` (text) — which section of the report: 'summary', 'sector', 'entity', 'performer'
     - `sort_order` (int) — ordering within a section
     - `label` (text) — display label (sector name, entity name, or ticker)
     - `label_2` (text, nullable) — secondary label (e.g. share name for performers)
     - `value` (numeric) — primary numeric value
     - `percentage` (numeric) — percentage value
     - `extra_value` (numeric, nullable) — secondary value (e.g. share count for entities)
     - `is_top_performer` (bool, nullable) — true for top performers, false for bottom
     - `source_hash` (text) — hash matching the share_analytics_cache batch
     - `computed_at` (timestamptz) — when this batch was computed

2. Security
   - Enable RLS on `portfolio_cache`.
   - Authenticated users can SELECT, INSERT, UPDATE, DELETE (shared analytics).

3. Indexes
   - Index on `(scope, source_hash)` for quick cache-hit checks
   - Index on `computed_at` for ordering

4. Important Notes
   - The Portfolio page computes a source hash the same way ShareAnalytics does
     (from max updated_at of source tables). If a cached batch with that hash exists,
     it reads directly from this table. If not, it reads per-entity-share holdings
     from share_analytics_cache (triggering ShareAnalytics recompute if needed),
     aggregates them, stores the results here, and displays them.
   - Old cache rows are deleted before inserting a new batch.
*/

CREATE TABLE IF NOT EXISTS portfolio_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           text   NOT NULL,
  section         text   NOT NULL,
  sort_order      int    NOT NULL DEFAULT 0,
  label           text   NOT NULL DEFAULT '',
  label_2         text,
  value           numeric(20, 4) NOT NULL DEFAULT 0,
  percentage      numeric(10, 4) NOT NULL DEFAULT 0,
  extra_value     numeric(20, 4),
  is_top_performer boolean,
  source_hash     text   NOT NULL,
  computed_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_portfolio_cache" ON portfolio_cache;
CREATE POLICY "select_portfolio_cache"
  ON portfolio_cache FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_portfolio_cache" ON portfolio_cache;
CREATE POLICY "insert_portfolio_cache"
  ON portfolio_cache FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_portfolio_cache" ON portfolio_cache;
CREATE POLICY "update_portfolio_cache"
  ON portfolio_cache FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_portfolio_cache" ON portfolio_cache;
CREATE POLICY "delete_portfolio_cache"
  ON portfolio_cache FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_portfolio_cache_scope_hash
  ON portfolio_cache(scope, source_hash);
CREATE INDEX IF NOT EXISTS idx_portfolio_cache_computed_at
  ON portfolio_cache(computed_at DESC);