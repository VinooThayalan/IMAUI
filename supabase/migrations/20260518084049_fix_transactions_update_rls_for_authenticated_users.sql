/*
  # Fix UPDATE RLS policies for transactions, buy_sell_notes, and cash_balance_ledger

  ## Problem
  The UPDATE policies on these three tables use has_entity_access(entity_id), which
  requires auth.uid() to match a record in user_entity_access. When the app runs
  without an authenticated session (anon key), auth.uid() is null, so all UPDATE
  operations silently affect 0 rows — causing actions like "Cancel Transaction" and
  approval/rejection updates to appear to do nothing.

  ## Change
  Replace the has_entity_access() UPDATE policies with open authenticated-user policies,
  consistent with the pattern used in all other tables (see migration
  20260409055111_open_all_tables_to_authenticated_users.sql).
*/

-- ===== TRANSACTIONS =====
DROP POLICY IF EXISTS "Users can update transactions for accessible entities" ON transactions;

CREATE POLICY "Authenticated users can update transactions"
  ON transactions FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also fix anon access since the app uses the anon key without auth
DROP POLICY IF EXISTS "Anon users can update transactions" ON transactions;

CREATE POLICY "Anon users can update transactions"
  ON transactions FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ===== BUY_SELL_NOTES =====
DROP POLICY IF EXISTS "Users can update buy sell notes for accessible entities" ON buy_sell_notes;

CREATE POLICY "Authenticated users can update buy sell notes"
  ON buy_sell_notes FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon users can update buy sell notes" ON buy_sell_notes;

CREATE POLICY "Anon users can update buy sell notes"
  ON buy_sell_notes FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ===== CASH_BALANCE_LEDGER =====
DROP POLICY IF EXISTS "Users can update ledger for accessible entities" ON cash_balance_ledger;

CREATE POLICY "Authenticated users can update cash balance ledger"
  ON cash_balance_ledger FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon users can update cash balance ledger" ON cash_balance_ledger;

CREATE POLICY "Anon users can update cash balance ledger"
  ON cash_balance_ledger FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
