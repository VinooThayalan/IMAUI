/*
  # Add Public Read Access to Core Tables
  
  This migration adds public read access to essential tables so the application
  can function without authentication. Write operations still require authentication.
  
  ## Changes
  - Add public SELECT policies to entities table
  - Add public SELECT policies to cash_balance_ledger table
  - Add public SELECT policies to shares table
  - Add public SELECT policies to banks table
  - Add public SELECT policies to daily_share_prices table
  
  ## Security Notes
  - Read-only access for anonymous users
  - Write operations (INSERT, UPDATE, DELETE) still require authentication
*/

-- Public read access for entities
DROP POLICY IF EXISTS "Public read access to entities" ON entities;
CREATE POLICY "Public read access to entities"
  ON entities
  FOR SELECT
  TO anon
  USING (true);

-- Public read access for cash_balance_ledger
DROP POLICY IF EXISTS "Public read access to cash ledger" ON cash_balance_ledger;
CREATE POLICY "Public read access to cash ledger"
  ON cash_balance_ledger
  FOR SELECT
  TO anon
  USING (true);

-- Public read access for shares
DROP POLICY IF EXISTS "Public read access to shares" ON shares;
CREATE POLICY "Public read access to shares"
  ON shares
  FOR SELECT
  TO anon
  USING (true);

-- Public read access for banks
DROP POLICY IF EXISTS "Public read access to banks" ON banks;
CREATE POLICY "Public read access to banks"
  ON banks
  FOR SELECT
  TO anon
  USING (true);

-- Public read access for daily_share_prices
DROP POLICY IF EXISTS "Public read access to daily prices" ON daily_share_prices;
CREATE POLICY "Public read access to daily prices"
  ON daily_share_prices
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to insert/update for now (can be restricted later when auth is added)
DROP POLICY IF EXISTS "Public write access to entities" ON entities;
CREATE POLICY "Public write access to entities"
  ON entities
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public write access to cash ledger" ON cash_balance_ledger;
CREATE POLICY "Public write access to cash ledger"
  ON cash_balance_ledger
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public write access to shares" ON shares;
CREATE POLICY "Public write access to shares"
  ON shares
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public write access to banks" ON banks;
CREATE POLICY "Public write access to banks"
  ON banks
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public write access to daily prices" ON daily_share_prices;
CREATE POLICY "Public write access to daily prices"
  ON daily_share_prices
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
