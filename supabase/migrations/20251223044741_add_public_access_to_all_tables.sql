/*
  # Add Public Access to All Application Tables
  
  This migration adds public access to all application tables so the app
  can function without authentication.
  
  ## Changes
  - Add public SELECT and write policies to transactions
  - Add public SELECT and write policies to transaction_requests
  - Add public SELECT and write policies to scrip_entries
  - Add public SELECT and write policies to buy_sell_notes
  - Add public SELECT and write policies to dividends
  - Add public SELECT and write policies to transaction_approvals
  - Add public SELECT and write policies to transaction_documents
  - Add public SELECT and write policies to share_earnings
  - Add public SELECT and write policies to share_values
  - Add public SELECT and write policies to share_52week_values
  - Add public SELECT and write policies to share_dividends_per_share
  
  ## Security Notes
  - Read and write access for anonymous users
  - Can be restricted later when authentication is added
*/

-- transactions
DROP POLICY IF EXISTS "Public read access to transactions" ON transactions;
CREATE POLICY "Public read access to transactions"
  ON transactions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to transactions" ON transactions;
CREATE POLICY "Public write access to transactions"
  ON transactions FOR ALL TO anon USING (true) WITH CHECK (true);

-- transaction_requests
DROP POLICY IF EXISTS "Public read access to transaction requests" ON transaction_requests;
CREATE POLICY "Public read access to transaction requests"
  ON transaction_requests FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to transaction requests" ON transaction_requests;
CREATE POLICY "Public write access to transaction requests"
  ON transaction_requests FOR ALL TO anon USING (true) WITH CHECK (true);

-- scrip_entries
DROP POLICY IF EXISTS "Public read access to scrip entries" ON scrip_entries;
CREATE POLICY "Public read access to scrip entries"
  ON scrip_entries FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to scrip entries" ON scrip_entries;
CREATE POLICY "Public write access to scrip entries"
  ON scrip_entries FOR ALL TO anon USING (true) WITH CHECK (true);

-- buy_sell_notes
DROP POLICY IF EXISTS "Public read access to buy sell notes" ON buy_sell_notes;
CREATE POLICY "Public read access to buy sell notes"
  ON buy_sell_notes FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to buy sell notes" ON buy_sell_notes;
CREATE POLICY "Public write access to buy sell notes"
  ON buy_sell_notes FOR ALL TO anon USING (true) WITH CHECK (true);

-- dividends
DROP POLICY IF EXISTS "Public read access to dividends" ON dividends;
CREATE POLICY "Public read access to dividends"
  ON dividends FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to dividends" ON dividends;
CREATE POLICY "Public write access to dividends"
  ON dividends FOR ALL TO anon USING (true) WITH CHECK (true);

-- transaction_approvals
DROP POLICY IF EXISTS "Public read access to transaction approvals" ON transaction_approvals;
CREATE POLICY "Public read access to transaction approvals"
  ON transaction_approvals FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to transaction approvals" ON transaction_approvals;
CREATE POLICY "Public write access to transaction approvals"
  ON transaction_approvals FOR ALL TO anon USING (true) WITH CHECK (true);

-- transaction_documents
DROP POLICY IF EXISTS "Public read access to transaction documents" ON transaction_documents;
CREATE POLICY "Public read access to transaction documents"
  ON transaction_documents FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to transaction documents" ON transaction_documents;
CREATE POLICY "Public write access to transaction documents"
  ON transaction_documents FOR ALL TO anon USING (true) WITH CHECK (true);

-- share_earnings
DROP POLICY IF EXISTS "Public read access to share earnings" ON share_earnings;
CREATE POLICY "Public read access to share earnings"
  ON share_earnings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to share earnings" ON share_earnings;
CREATE POLICY "Public write access to share earnings"
  ON share_earnings FOR ALL TO anon USING (true) WITH CHECK (true);

-- share_values
DROP POLICY IF EXISTS "Public read access to share values" ON share_values;
CREATE POLICY "Public read access to share values"
  ON share_values FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to share values" ON share_values;
CREATE POLICY "Public write access to share values"
  ON share_values FOR ALL TO anon USING (true) WITH CHECK (true);

-- share_52week_values
DROP POLICY IF EXISTS "Public read access to 52week values" ON share_52week_values;
CREATE POLICY "Public read access to 52week values"
  ON share_52week_values FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to 52week values" ON share_52week_values;
CREATE POLICY "Public write access to 52week values"
  ON share_52week_values FOR ALL TO anon USING (true) WITH CHECK (true);

-- share_dividends_per_share
DROP POLICY IF EXISTS "Public read access to dividends per share" ON share_dividends_per_share;
CREATE POLICY "Public read access to dividends per share"
  ON share_dividends_per_share FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to dividends per share" ON share_dividends_per_share;
CREATE POLICY "Public write access to dividends per share"
  ON share_dividends_per_share FOR ALL TO anon USING (true) WITH CHECK (true);

-- cash_balance_config
DROP POLICY IF EXISTS "Public read access to cash config" ON cash_balance_config;
CREATE POLICY "Public read access to cash config"
  ON cash_balance_config FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public write access to cash config" ON cash_balance_config;
CREATE POLICY "Public write access to cash config"
  ON cash_balance_config FOR ALL TO anon USING (true) WITH CHECK (true);
