/*
  Scope INSERT/UPDATE/DELETE on entity-owned tables to has_entity_access(entity_id).
  Previously these had USING(true) so any signed-in user could change another
  company's banks, broker assignments, opening balances, dividends, etc.
*/

-- banks
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='banks' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.banks', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert banks for their entities" ON public.banks FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update banks for their entities" ON public.banks FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete banks for their entities" ON public.banks FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- entity_brokers
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='entity_brokers' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.entity_brokers', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert entity brokers for their entities" ON public.entity_brokers FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update entity brokers for their entities" ON public.entity_brokers FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete entity brokers for their entities" ON public.entity_brokers FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- entity_share_opening_balances
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='entity_share_opening_balances' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.entity_share_opening_balances', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert opening balances for their entities" ON public.entity_share_opening_balances FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update opening balances for their entities" ON public.entity_share_opening_balances FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete opening balances for their entities" ON public.entity_share_opening_balances FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- scrip_entries
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='scrip_entries' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.scrip_entries', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert scrip entries for their entities" ON public.scrip_entries FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update scrip entries for their entities" ON public.scrip_entries FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete scrip entries for their entities" ON public.scrip_entries FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));
-- [no-op on self-hosted: table 'corporate_actions' is not created by any migration]
-- -- corporate_actions
-- DO $$ DECLARE p record; BEGIN
--   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='corporate_actions' AND cmd IN ('INSERT','UPDATE','DELETE')
--   LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.corporate_actions', p.policyname); END LOOP;
-- END $$;

-- [no-op on self-hosted: table 'corporate_actions' is not created by any migration]
-- CREATE POLICY "Users can insert corporate actions for their entities" ON public.corporate_actions FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));

-- [no-op on self-hosted: table 'corporate_actions' is not created by any migration]
-- CREATE POLICY "Users can update corporate actions for their entities" ON public.corporate_actions FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));

-- [no-op on self-hosted: table 'corporate_actions' is not created by any migration]
-- CREATE POLICY "Users can delete corporate actions for their entities" ON public.corporate_actions FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- [no-op on self-hosted: table 'corporate_action_history' is not created by any migration]
-- -- corporate_action_history
-- DO $$ DECLARE p record; BEGIN
--   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='corporate_action_history' AND cmd IN ('INSERT','UPDATE','DELETE')
--   LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.corporate_action_history', p.policyname); END LOOP;
-- END $$;

-- [no-op on self-hosted: table 'corporate_action_history' is not created by any migration]
-- CREATE POLICY "Users can insert corporate action history for their entities" ON public.corporate_action_history FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));

-- [no-op on self-hosted: table 'corporate_action_history' is not created by any migration]
-- CREATE POLICY "Users can update corporate action history for their entities" ON public.corporate_action_history FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));

-- [no-op on self-hosted: table 'corporate_action_history' is not created by any migration]
-- CREATE POLICY "Users can delete corporate action history for their entities" ON public.corporate_action_history FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));


-- transaction_requests
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='transaction_requests' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.transaction_requests', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert transaction requests for their entities" ON public.transaction_requests FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update transaction requests for their entities" ON public.transaction_requests FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete transaction requests for their entities" ON public.transaction_requests FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- dividends
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='dividends' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.dividends', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert dividends for their entities" ON public.dividends FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update dividends for their entities" ON public.dividends FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete dividends for their entities" ON public.dividends FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- share_values
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='share_values' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_values', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert share values for their entities" ON public.share_values FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update share values for their entities" ON public.share_values FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete share values for their entities" ON public.share_values FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- share_earnings
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='share_earnings' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_earnings', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert share earnings for their entities" ON public.share_earnings FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update share earnings for their entities" ON public.share_earnings FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete share earnings for their entities" ON public.share_earnings FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- share_dividends_per_share
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='share_dividends_per_share' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_dividends_per_share', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert share dividends per share for their entities" ON public.share_dividends_per_share FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can update share dividends per share for their entities" ON public.share_dividends_per_share FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id)) WITH CHECK (public.has_entity_access(entity_id));
CREATE POLICY "Users can delete share dividends per share for their entities" ON public.share_dividends_per_share FOR DELETE TO authenticated USING (public.has_entity_access(entity_id));

-- share_analytics_cache (entity_id is text, cast to uuid)
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='share_analytics_cache' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_analytics_cache', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert analytics cache for their entities" ON public.share_analytics_cache FOR INSERT TO authenticated WITH CHECK (public.has_entity_access(entity_id::uuid));
CREATE POLICY "Users can update analytics cache for their entities" ON public.share_analytics_cache FOR UPDATE TO authenticated USING (public.has_entity_access(entity_id::uuid)) WITH CHECK (public.has_entity_access(entity_id::uuid));
CREATE POLICY "Users can delete analytics cache for their entities" ON public.share_analytics_cache FOR DELETE TO authenticated USING (public.has_entity_access(entity_id::uuid));

-- portfolio_cache (no entity_id column — derived from RLS-protected sources)
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='portfolio_cache' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.portfolio_cache', p.policyname); END LOOP;
END $$;
CREATE POLICY "Authenticated users can insert portfolio cache" ON public.portfolio_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update portfolio cache" ON public.portfolio_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete portfolio cache" ON public.portfolio_cache FOR DELETE TO authenticated USING (true);
