-- The app uses the anon key (no Supabase Auth), so RLS policies must include
-- the anon role. The original cache-table migrations only granted access to
-- `authenticated`, which meant the anon-key client silently failed every
-- INSERT/SELECT/DELETE on these tables.

-- share_analytics_cache: add anon to all four CRUD policies
DROP POLICY IF EXISTS "select_analytics_cache_anon" ON share_analytics_cache;
CREATE POLICY "select_analytics_cache_anon"
  ON share_analytics_cache FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "insert_analytics_cache_anon" ON share_analytics_cache;
CREATE POLICY "insert_analytics_cache_anon"
  ON share_analytics_cache FOR INSERT
  TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "update_analytics_cache_anon" ON share_analytics_cache;
CREATE POLICY "update_analytics_cache_anon"
  ON share_analytics_cache FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_analytics_cache_anon" ON share_analytics_cache;
CREATE POLICY "delete_analytics_cache_anon"
  ON share_analytics_cache FOR DELETE
  TO anon USING (true);

-- portfolio_cache: add anon to all four CRUD policies
DROP POLICY IF EXISTS "select_portfolio_cache_anon" ON portfolio_cache;
CREATE POLICY "select_portfolio_cache_anon"
  ON portfolio_cache FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "insert_portfolio_cache_anon" ON portfolio_cache;
CREATE POLICY "insert_portfolio_cache_anon"
  ON portfolio_cache FOR INSERT
  TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "update_portfolio_cache_anon" ON portfolio_cache;
CREATE POLICY "update_portfolio_cache_anon"
  ON portfolio_cache FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_portfolio_cache_anon" ON portfolio_cache;
CREATE POLICY "delete_portfolio_cache_anon"
  ON portfolio_cache FOR DELETE
  TO anon USING (true);
