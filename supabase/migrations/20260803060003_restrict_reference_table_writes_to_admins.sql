/*
  Restrict writes on reference/config tables to admins. These are shared
  lookup tables (shares, brokers, banks, fees, sectors, etc.) with no
  entity_id. Any signed-in user can read them; only admins can change them.
*/

-- amalgamations
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='amalgamations' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.amalgamations', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert amalgamations" ON public.amalgamations FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update amalgamations" ON public.amalgamations FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete amalgamations" ON public.amalgamations FOR DELETE TO authenticated USING (public.is_app_admin());

-- rights_issues
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='rights_issues' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.rights_issues', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert rights issues" ON public.rights_issues FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update rights issues" ON public.rights_issues FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete rights issues" ON public.rights_issues FOR DELETE TO authenticated USING (public.is_app_admin());

-- share_buybacks
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='share_buybacks' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_buybacks', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert share buybacks" ON public.share_buybacks FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update share buybacks" ON public.share_buybacks FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete share buybacks" ON public.share_buybacks FOR DELETE TO authenticated USING (public.is_app_admin());

-- share_subdivisions
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='share_subdivisions' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_subdivisions', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert share subdivisions" ON public.share_subdivisions FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update share subdivisions" ON public.share_subdivisions FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete share subdivisions" ON public.share_subdivisions FOR DELETE TO authenticated USING (public.is_app_admin());

-- bank_branches
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='bank_branches' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.bank_branches', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert bank branches" ON public.bank_branches FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update bank branches" ON public.bank_branches FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete bank branches" ON public.bank_branches FOR DELETE TO authenticated USING (public.is_app_admin());

-- bank_master
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='bank_master' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.bank_master', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert bank master" ON public.bank_master FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update bank master" ON public.bank_master FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

-- brokerage_fee_types
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='brokerage_fee_types' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.brokerage_fee_types', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert brokerage fee types" ON public.brokerage_fee_types FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update brokerage fee_types" ON public.brokerage_fee_types FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete brokerage fee types" ON public.brokerage_fee_types FOR DELETE TO authenticated USING (public.is_app_admin());

-- brokers
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='brokers' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.brokers', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert brokers" ON public.brokers FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update brokers" ON public.brokers FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete brokers" ON public.brokers FOR DELETE TO authenticated USING (public.is_app_admin());

-- currencies
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='currencies' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.currencies', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert currencies" ON public.currencies FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update currencies" ON public.currencies FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete currencies" ON public.currencies FOR DELETE TO authenticated USING (public.is_app_admin());

-- entity_types
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='entity_types' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.entity_types', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert entity types" ON public.entity_types FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update entity types" ON public.entity_types FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete entity types" ON public.entity_types FOR DELETE TO authenticated USING (public.is_app_admin());

-- industry_types
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='industry_types' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.industry_types', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert industry types" ON public.industry_types FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update industry types" ON public.industry_types FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete industry types" ON public.industry_types FOR DELETE TO authenticated USING (public.is_app_admin());

-- sector_types
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sector_types' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.sector_types', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert sector types" ON public.sector_types FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update sector types" ON public.sector_types FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete sector types" ON public.sector_types FOR DELETE TO authenticated USING (public.is_app_admin());

-- fee_components
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fee_components' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.fee_components', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert fee components" ON public.fee_components FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update fee components" ON public.fee_components FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete fee components" ON public.fee_components FOR DELETE TO authenticated USING (public.is_app_admin());

-- fee_rates
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fee_rates' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.fee_rates', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert fee rates" ON public.fee_rates FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update fee rates" ON public.fee_rates FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete fee rates" ON public.fee_rates FOR DELETE TO authenticated USING (public.is_app_admin());

-- fee_tiers
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fee_tiers' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.fee_tiers', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert fee tiers" ON public.fee_tiers FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update fee tiers" ON public.fee_tiers FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete fee tiers" ON public.fee_tiers FOR DELETE TO authenticated USING (public.is_app_admin());

-- daily_share_prices
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='daily_share_prices' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.daily_share_prices', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert daily share prices" ON public.daily_share_prices FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update daily share prices" ON public.daily_share_prices FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete daily share prices" ON public.daily_share_prices FOR DELETE TO authenticated USING (public.is_app_admin());

-- shares
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='shares' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.shares', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert shares" ON public.shares FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update shares" ON public.shares FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete shares" ON public.shares FOR DELETE TO authenticated USING (public.is_app_admin());

-- share_52week_values
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='share_52week_values' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_52week_values', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert 52week values" ON public.share_52week_values FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update 52week values" ON public.share_52week_values FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete 52week values" ON public.share_52week_values FOR DELETE TO authenticated USING (public.is_app_admin());

-- menu_items
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='menu_items' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.menu_items', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert menu items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update menu items" ON public.menu_items FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete menu items" ON public.menu_items FOR DELETE TO authenticated USING (public.is_app_admin());

-- cash_balance_config
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='cash_balance_config' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.cash_balance_config', p.policyname); END LOOP;
END $$;
CREATE POLICY "Admins can insert cash balance config" ON public.cash_balance_config FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update cash balance config" ON public.cash_balance_config FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete cash balance config" ON public.cash_balance_config FOR DELETE TO authenticated USING (public.is_app_admin());

-- email_logs: system-generated, append-only
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='email_logs' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.email_logs', p.policyname); END LOOP;
END $$;
CREATE POLICY "Users can insert email logs" ON public.email_logs FOR INSERT TO authenticated WITH CHECK (true);
REVOKE UPDATE, DELETE ON public.email_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.email_logs FROM anon;

-- audit_logs: clean up anon, append-only
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.audit_settings FROM anon;
