/*
  # Enforce entity-level data isolation via RLS

  1. Overview
    - Creates a helper function `has_entity_access(uuid)` that checks whether
      the current user is an admin OR has explicit access to a given entity
    - Updates RLS SELECT/INSERT/UPDATE/DELETE policies on all entity-linked tables
      so non-admin users can only access data belonging to their assigned entities
    - Admins bypass all entity restrictions automatically

  2. New Function
    - `has_entity_access(p_entity_id uuid)` returns boolean
      - Returns true if user is an admin (via is_app_admin())
      - Returns true if user has a row in user_entity_access for the given entity
      - SECURITY DEFINER to avoid nested RLS issues on user_entity_access
      - STABLE for query planner optimization

  3. Tables with direct entity_id FK (13 tables)
    - entities (uses `id` as the entity reference)
    - banks, cash_balance_ledger, corporate_action_history, corporate_actions,
      dividends, entity_brokers, scrip_entries, share_dividends_per_share,
      share_earnings, share_values, transaction_requests, transactions

  4. Tables with indirect entity relationship (4 tables)
    - transaction_approvals (via transaction_requests.entity_id)
    - transaction_documents (via transaction_requests.entity_id)
    - buy_sell_notes (via transactions.entity_id)
    - buy_sell_approvals (via buy_sell_notes -> transactions.entity_id)

  5. Security Model
    - Non-admin users: can only SELECT/INSERT/UPDATE/DELETE data for entities
      they have been granted access to via user_entity_access
    - Admin users: full access to all entities (bypass check)
*/

-- ============================================
-- 1. CREATE ENTITY ACCESS HELPER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.has_entity_access(p_entity_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_entity_access
      WHERE user_id = (select auth.uid())
      AND entity_id = p_entity_id
    );
$$;


-- ============================================
-- 2. ENTITIES TABLE (uses `id` not `entity_id`)
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read entities" ON entities;
DROP POLICY IF EXISTS "Authenticated users can insert entities" ON entities;
DROP POLICY IF EXISTS "Authenticated users can update entities" ON entities;
DROP POLICY IF EXISTS "Authenticated users can delete entities" ON entities;

CREATE POLICY "Users can read accessible entities"
  ON entities FOR SELECT TO authenticated
  USING (public.has_entity_access(id));

CREATE POLICY "Admins can insert entities"
  ON entities FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Users can update accessible entities"
  ON entities FOR UPDATE TO authenticated
  USING (public.has_entity_access(id))
  WITH CHECK (public.has_entity_access(id));

CREATE POLICY "Admins can delete entities"
  ON entities FOR DELETE TO authenticated
  USING (public.is_app_admin());


-- ============================================
-- 3. DIRECT ENTITY_ID TABLES
-- ============================================

-- banks
DROP POLICY IF EXISTS "Authenticated users can read banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can insert banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can update banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can delete banks" ON banks;

CREATE POLICY "Users can read banks for accessible entities"
  ON banks FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert banks for accessible entities"
  ON banks FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update banks for accessible entities"
  ON banks FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete banks for accessible entities"
  ON banks FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- cash_balance_ledger
DROP POLICY IF EXISTS "Authenticated users can read ledger entries" ON cash_balance_ledger;
DROP POLICY IF EXISTS "Authenticated users can insert ledger entries" ON cash_balance_ledger;
DROP POLICY IF EXISTS "Authenticated users can update ledger entries" ON cash_balance_ledger;
DROP POLICY IF EXISTS "Authenticated users can delete ledger entries" ON cash_balance_ledger;

CREATE POLICY "Users can read ledger for accessible entities"
  ON cash_balance_ledger FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert ledger for accessible entities"
  ON cash_balance_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update ledger for accessible entities"
  ON cash_balance_ledger FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete ledger for accessible entities"
  ON cash_balance_ledger FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- corporate_action_history
DROP POLICY IF EXISTS "Authenticated users can read corporate action history" ON corporate_action_history;
DROP POLICY IF EXISTS "Admins can insert corporate action history" ON corporate_action_history;
DROP POLICY IF EXISTS "Admins can update corporate action history" ON corporate_action_history;
DROP POLICY IF EXISTS "Admins can delete corporate action history" ON corporate_action_history;

CREATE POLICY "Users can read corp action history for accessible entities"
  ON corporate_action_history FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert corp action history for accessible entities"
  ON corporate_action_history FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update corp action history for accessible entities"
  ON corporate_action_history FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete corp action history for accessible entities"
  ON corporate_action_history FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- corporate_actions
DROP POLICY IF EXISTS "Authenticated users can read corporate actions" ON corporate_actions;
DROP POLICY IF EXISTS "Admins can insert corporate actions" ON corporate_actions;
DROP POLICY IF EXISTS "Admins can update corporate actions" ON corporate_actions;
DROP POLICY IF EXISTS "Admins can delete corporate actions" ON corporate_actions;

CREATE POLICY "Users can read corp actions for accessible entities"
  ON corporate_actions FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert corp actions for accessible entities"
  ON corporate_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update corp actions for accessible entities"
  ON corporate_actions FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete corp actions for accessible entities"
  ON corporate_actions FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- dividends
DROP POLICY IF EXISTS "Authenticated users can read dividends" ON dividends;
DROP POLICY IF EXISTS "Authenticated users can insert dividends" ON dividends;
DROP POLICY IF EXISTS "Authenticated users can update dividends" ON dividends;
DROP POLICY IF EXISTS "Authenticated users can delete dividends" ON dividends;

CREATE POLICY "Users can read dividends for accessible entities"
  ON dividends FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert dividends for accessible entities"
  ON dividends FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update dividends for accessible entities"
  ON dividends FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete dividends for accessible entities"
  ON dividends FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- entity_brokers
DROP POLICY IF EXISTS "Authenticated users can read entity brokers" ON entity_brokers;
DROP POLICY IF EXISTS "Authenticated users can insert entity brokers" ON entity_brokers;
DROP POLICY IF EXISTS "Authenticated users can update entity brokers" ON entity_brokers;
DROP POLICY IF EXISTS "Authenticated users can delete entity brokers" ON entity_brokers;

CREATE POLICY "Users can read entity brokers for accessible entities"
  ON entity_brokers FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert entity brokers for accessible entities"
  ON entity_brokers FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update entity brokers for accessible entities"
  ON entity_brokers FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete entity brokers for accessible entities"
  ON entity_brokers FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- scrip_entries
DROP POLICY IF EXISTS "Authenticated users can read scrip entries" ON scrip_entries;
DROP POLICY IF EXISTS "Authenticated users can insert scrip entries" ON scrip_entries;
DROP POLICY IF EXISTS "Authenticated users can update scrip entries" ON scrip_entries;
DROP POLICY IF EXISTS "Authenticated users can delete scrip entries" ON scrip_entries;

CREATE POLICY "Users can read scrip entries for accessible entities"
  ON scrip_entries FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert scrip entries for accessible entities"
  ON scrip_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update scrip entries for accessible entities"
  ON scrip_entries FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete scrip entries for accessible entities"
  ON scrip_entries FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- share_dividends_per_share
DROP POLICY IF EXISTS "Authenticated users can read dividends per share" ON share_dividends_per_share;
DROP POLICY IF EXISTS "Authenticated users can insert dividends per share" ON share_dividends_per_share;
DROP POLICY IF EXISTS "Authenticated users can update dividends per share" ON share_dividends_per_share;
DROP POLICY IF EXISTS "Authenticated users can delete dividends per share" ON share_dividends_per_share;

CREATE POLICY "Users can read div per share for accessible entities"
  ON share_dividends_per_share FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert div per share for accessible entities"
  ON share_dividends_per_share FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update div per share for accessible entities"
  ON share_dividends_per_share FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete div per share for accessible entities"
  ON share_dividends_per_share FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- share_earnings
DROP POLICY IF EXISTS "Authenticated users can read earnings" ON share_earnings;
DROP POLICY IF EXISTS "Authenticated users can insert earnings" ON share_earnings;
DROP POLICY IF EXISTS "Authenticated users can update earnings" ON share_earnings;
DROP POLICY IF EXISTS "Authenticated users can delete earnings" ON share_earnings;

CREATE POLICY "Users can read earnings for accessible entities"
  ON share_earnings FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert earnings for accessible entities"
  ON share_earnings FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update earnings for accessible entities"
  ON share_earnings FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete earnings for accessible entities"
  ON share_earnings FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- share_values
DROP POLICY IF EXISTS "Authenticated users can read share values" ON share_values;
DROP POLICY IF EXISTS "Authenticated users can insert share values" ON share_values;
DROP POLICY IF EXISTS "Authenticated users can update share values" ON share_values;
DROP POLICY IF EXISTS "Authenticated users can delete share values" ON share_values;

CREATE POLICY "Users can read share values for accessible entities"
  ON share_values FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert share values for accessible entities"
  ON share_values FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update share values for accessible entities"
  ON share_values FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete share values for accessible entities"
  ON share_values FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- transaction_requests
DROP POLICY IF EXISTS "Authenticated users can read transaction requests" ON transaction_requests;
DROP POLICY IF EXISTS "Authenticated users can insert transaction requests" ON transaction_requests;
DROP POLICY IF EXISTS "Authenticated users can update transaction requests" ON transaction_requests;
DROP POLICY IF EXISTS "Authenticated users can delete transaction requests" ON transaction_requests;

CREATE POLICY "Users can read tx requests for accessible entities"
  ON transaction_requests FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert tx requests for accessible entities"
  ON transaction_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update tx requests for accessible entities"
  ON transaction_requests FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete tx requests for accessible entities"
  ON transaction_requests FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));

-- transactions
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can delete transactions" ON transactions;

CREATE POLICY "Users can read transactions for accessible entities"
  ON transactions FOR SELECT TO authenticated
  USING (public.has_entity_access(entity_id));
CREATE POLICY "Users can insert transactions for accessible entities"
  ON transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update transactions for accessible entities"
  ON transactions FOR UPDATE TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete transactions for accessible entities"
  ON transactions FOR DELETE TO authenticated
  USING (public.has_entity_access(entity_id));


-- ============================================
-- 4. INDIRECT ENTITY TABLES
-- ============================================

-- transaction_approvals (via transaction_requests.entity_id)
DROP POLICY IF EXISTS "Authenticated users can read transaction approvals" ON transaction_approvals;
DROP POLICY IF EXISTS "Authenticated users can insert transaction approvals" ON transaction_approvals;
DROP POLICY IF EXISTS "Authenticated users can update transaction approvals" ON transaction_approvals;
DROP POLICY IF EXISTS "Authenticated users can delete transaction approvals" ON transaction_approvals;

CREATE POLICY "Users can read tx approvals for accessible entities"
  ON transaction_approvals FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_approvals.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );
CREATE POLICY "Users can insert tx approvals for accessible entities"
  ON transaction_approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_approvals.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );
CREATE POLICY "Users can update tx approvals for accessible entities"
  ON transaction_approvals FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_approvals.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_approvals.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );
CREATE POLICY "Users can delete tx approvals for accessible entities"
  ON transaction_approvals FOR DELETE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_approvals.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );

-- transaction_documents (via transaction_requests.entity_id)
DROP POLICY IF EXISTS "Authenticated users can read transaction documents" ON transaction_documents;
DROP POLICY IF EXISTS "Authenticated users can insert transaction documents" ON transaction_documents;
DROP POLICY IF EXISTS "Authenticated users can update transaction documents" ON transaction_documents;
DROP POLICY IF EXISTS "Authenticated users can delete transaction documents" ON transaction_documents;

CREATE POLICY "Users can read tx docs for accessible entities"
  ON transaction_documents FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_documents.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );
CREATE POLICY "Users can insert tx docs for accessible entities"
  ON transaction_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_documents.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );
CREATE POLICY "Users can update tx docs for accessible entities"
  ON transaction_documents FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_documents.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_documents.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );
CREATE POLICY "Users can delete tx docs for accessible entities"
  ON transaction_documents FOR DELETE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transaction_requests tr
      WHERE tr.id = transaction_documents.transaction_request_id
      AND public.has_entity_access(tr.entity_id)
    )
  );

-- buy_sell_notes (via transactions.entity_id)
DROP POLICY IF EXISTS "Authenticated users can read buy sell notes" ON buy_sell_notes;
DROP POLICY IF EXISTS "Authenticated users can insert buy sell notes" ON buy_sell_notes;
DROP POLICY IF EXISTS "Authenticated users can update buy sell notes" ON buy_sell_notes;
DROP POLICY IF EXISTS "Authenticated users can delete buy sell notes" ON buy_sell_notes;

CREATE POLICY "Users can read buy sell notes for accessible entities"
  ON buy_sell_notes FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = buy_sell_notes.transaction_id
      AND public.has_entity_access(t.entity_id)
    )
  );
CREATE POLICY "Users can insert buy sell notes for accessible entities"
  ON buy_sell_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = buy_sell_notes.transaction_id
      AND public.has_entity_access(t.entity_id)
    )
  );
CREATE POLICY "Users can update buy sell notes for accessible entities"
  ON buy_sell_notes FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = buy_sell_notes.transaction_id
      AND public.has_entity_access(t.entity_id)
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = buy_sell_notes.transaction_id
      AND public.has_entity_access(t.entity_id)
    )
  );
CREATE POLICY "Users can delete buy sell notes for accessible entities"
  ON buy_sell_notes FOR DELETE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = buy_sell_notes.transaction_id
      AND public.has_entity_access(t.entity_id)
    )
  );

-- buy_sell_approvals (via buy_sell_notes -> transactions.entity_id)
DROP POLICY IF EXISTS "Authenticated users can read buy sell approvals" ON buy_sell_approvals;
DROP POLICY IF EXISTS "Authenticated users can insert buy sell approvals" ON buy_sell_approvals;
DROP POLICY IF EXISTS "Authenticated users can update buy sell approvals" ON buy_sell_approvals;
DROP POLICY IF EXISTS "Authenticated users can delete buy sell approvals" ON buy_sell_approvals;

CREATE POLICY "Users can read buy sell approvals for accessible entities"
  ON buy_sell_approvals FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.buy_sell_notes bsn
      JOIN public.transactions t ON t.id = bsn.transaction_id
      WHERE bsn.id = buy_sell_approvals.buy_sell_note_id
      AND public.has_entity_access(t.entity_id)
    )
  );
CREATE POLICY "Users can insert buy sell approvals for accessible entities"
  ON buy_sell_approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.buy_sell_notes bsn
      JOIN public.transactions t ON t.id = bsn.transaction_id
      WHERE bsn.id = buy_sell_approvals.buy_sell_note_id
      AND public.has_entity_access(t.entity_id)
    )
  );
CREATE POLICY "Users can update buy sell approvals for accessible entities"
  ON buy_sell_approvals FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.buy_sell_notes bsn
      JOIN public.transactions t ON t.id = bsn.transaction_id
      WHERE bsn.id = buy_sell_approvals.buy_sell_note_id
      AND public.has_entity_access(t.entity_id)
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.buy_sell_notes bsn
      JOIN public.transactions t ON t.id = bsn.transaction_id
      WHERE bsn.id = buy_sell_approvals.buy_sell_note_id
      AND public.has_entity_access(t.entity_id)
    )
  );
CREATE POLICY "Users can delete buy sell approvals for accessible entities"
  ON buy_sell_approvals FOR DELETE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.buy_sell_notes bsn
      JOIN public.transactions t ON t.id = bsn.transaction_id
      WHERE bsn.id = buy_sell_approvals.buy_sell_note_id
      AND public.has_entity_access(t.entity_id)
    )
  );
