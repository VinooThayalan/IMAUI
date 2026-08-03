/*
  Scope write policies on approval, document, and access tables to entity access.
  Also restrict user_menu_access writes to admins.
*/

-- buy_sell_approvals: link through buy_sell_note_id -> transaction_id -> entity_id
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='buy_sell_approvals' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.buy_sell_approvals', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert buy sell approvals for their entities" ON public.buy_sell_approvals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.buy_sell_notes bsn WHERE bsn.id = buy_sell_approvals.buy_sell_note_id AND public.has_entity_access((SELECT t.entity_id FROM public.transactions t WHERE t.id = bsn.transaction_id))));
CREATE POLICY "Users can update buy sell approvals for their entities" ON public.buy_sell_approvals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.buy_sell_notes bsn WHERE bsn.id = buy_sell_approvals.buy_sell_note_id AND public.has_entity_access((SELECT t.entity_id FROM public.transactions t WHERE t.id = bsn.transaction_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.buy_sell_notes bsn WHERE bsn.id = buy_sell_approvals.buy_sell_note_id AND public.has_entity_access((SELECT t.entity_id FROM public.transactions t WHERE t.id = bsn.transaction_id))));
CREATE POLICY "Users can delete buy sell approvals for their entities" ON public.buy_sell_approvals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.buy_sell_notes bsn WHERE bsn.id = buy_sell_approvals.buy_sell_note_id AND public.has_entity_access((SELECT t.entity_id FROM public.transactions t WHERE t.id = bsn.transaction_id))));

-- transaction_approvals: link through transaction_request_id -> entity_id
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='transaction_approvals' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.transaction_approvals', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert transaction approvals for their entities" ON public.transaction_approvals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_approvals.transaction_request_id AND public.has_entity_access(tr.entity_id)));
CREATE POLICY "Users can update transaction approvals for their entities" ON public.transaction_approvals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_approvals.transaction_request_id AND public.has_entity_access(tr.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_approvals.transaction_request_id AND public.has_entity_access(tr.entity_id)));
CREATE POLICY "Users can delete transaction approvals for their entities" ON public.transaction_approvals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_approvals.transaction_request_id AND public.has_entity_access(tr.entity_id)));

-- transaction_documents: link through transaction_request_id -> entity_id
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='transaction_documents' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.transaction_documents', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert transaction documents for their entities" ON public.transaction_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_documents.transaction_request_id AND public.has_entity_access(tr.entity_id)));
CREATE POLICY "Users can update transaction documents for their entities" ON public.transaction_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_documents.transaction_request_id AND public.has_entity_access(tr.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_documents.transaction_request_id AND public.has_entity_access(tr.entity_id)));
CREATE POLICY "Users can delete transaction documents for their entities" ON public.transaction_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transaction_requests tr WHERE tr.id = transaction_documents.transaction_request_id AND public.has_entity_access(tr.entity_id)));

-- user_menu_access: admin-only writes
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_menu_access' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_menu_access', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert user menu access" ON public.user_menu_access FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update user menu access" ON public.user_menu_access FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete user menu access" ON public.user_menu_access FOR DELETE TO authenticated USING (public.is_app_admin());
