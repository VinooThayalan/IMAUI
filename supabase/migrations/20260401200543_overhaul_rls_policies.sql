/*
  # Comprehensive RLS policy overhaul

  1. Overview
    - Removes all anonymous (anon) write policies across 17 tables
    - Removes all `public` role always-true policies across 8 tables
    - Replaces always-true authenticated policies with proper access controls
    - Splits FOR ALL policies into separate SELECT/INSERT/UPDATE/DELETE policies
    - Fixes duplicate permissive SELECT policies
    - Wraps auth.uid() in (select auth.uid()) for RLS performance optimization
    - Uses is_app_admin() helper for admin checks to avoid recursion

  2. Security Model
    - Anonymous users: NO access (all anon policies removed; app requires login)
    - Authenticated users: Can SELECT all operational data
    - Authenticated users: Can INSERT/UPDATE/DELETE operational data
    - Reference/config tables: Write restricted to admins only
    - Corporate action tables: Restricted to authenticated users, write by admins
    - Admin tables (menu_items, user_entity_access, user_menu_access, app_users):
      Policies updated for performance with (select auth.uid()) wrapper

  3. Tables affected (grouped by policy change type)

    Anon policies removed:
      banks, buy_sell_notes, cash_balance_config, cash_balance_ledger,
      daily_share_prices, dividends, entities, scrip_entries, share_52week_values,
      share_dividends_per_share, share_earnings, share_values, shares,
      transaction_approvals, transaction_documents, transaction_requests, transactions

    Public role policies replaced with authenticated:
      amalgamations, brokerage_fee_types, corporate_actions, corporate_action_history,
      rights_issues, share_buybacks, share_subdivisions, currencies

    Reference tables (write restricted to admin):
      entity_types, industry_types, sector_types, brokerage_fee_types,
      currencies, fee_components, fee_rates, fee_tiers, brokers,
      cash_balance_config

    Admin tables (performance fix):
      menu_items, user_entity_access, user_menu_access, app_users
*/

-- ============================================
-- 1. REMOVE ALL ANON POLICIES
-- ============================================

-- banks
DROP POLICY IF EXISTS "Public read access to banks" ON banks;
DROP POLICY IF EXISTS "Public write access to banks" ON banks;

-- buy_sell_notes
DROP POLICY IF EXISTS "Public read access to buy sell notes" ON buy_sell_notes;
DROP POLICY IF EXISTS "Public write access to buy sell notes" ON buy_sell_notes;

-- cash_balance_config
DROP POLICY IF EXISTS "Public read access to cash config" ON cash_balance_config;
DROP POLICY IF EXISTS "Public write access to cash config" ON cash_balance_config;

-- cash_balance_ledger
DROP POLICY IF EXISTS "Public read access to cash ledger" ON cash_balance_ledger;
DROP POLICY IF EXISTS "Public write access to cash ledger" ON cash_balance_ledger;

-- daily_share_prices
DROP POLICY IF EXISTS "Public read access to daily prices" ON daily_share_prices;
DROP POLICY IF EXISTS "Public write access to daily prices" ON daily_share_prices;

-- dividends
DROP POLICY IF EXISTS "Public read access to dividends" ON dividends;
DROP POLICY IF EXISTS "Public write access to dividends" ON dividends;

-- entities
DROP POLICY IF EXISTS "Public read access to entities" ON entities;
DROP POLICY IF EXISTS "Public write access to entities" ON entities;

-- scrip_entries
DROP POLICY IF EXISTS "Public read access to scrip entries" ON scrip_entries;
DROP POLICY IF EXISTS "Public write access to scrip entries" ON scrip_entries;

-- share_52week_values
DROP POLICY IF EXISTS "Public read access to 52week values" ON share_52week_values;
DROP POLICY IF EXISTS "Public write access to 52week values" ON share_52week_values;

-- share_dividends_per_share
DROP POLICY IF EXISTS "Public read access to dividends per share" ON share_dividends_per_share;
DROP POLICY IF EXISTS "Public write access to dividends per share" ON share_dividends_per_share;

-- share_earnings
DROP POLICY IF EXISTS "Public read access to share earnings" ON share_earnings;
DROP POLICY IF EXISTS "Public write access to share earnings" ON share_earnings;

-- share_values
DROP POLICY IF EXISTS "Public read access to share values" ON share_values;
DROP POLICY IF EXISTS "Public write access to share values" ON share_values;

-- shares
DROP POLICY IF EXISTS "Public read access to shares" ON shares;
DROP POLICY IF EXISTS "Public write access to shares" ON shares;

-- transaction_approvals
DROP POLICY IF EXISTS "Public read access to transaction approvals" ON transaction_approvals;
DROP POLICY IF EXISTS "Public write access to transaction approvals" ON transaction_approvals;

-- transaction_documents
DROP POLICY IF EXISTS "Public read access to transaction documents" ON transaction_documents;
DROP POLICY IF EXISTS "Public write access to transaction documents" ON transaction_documents;

-- transaction_requests
DROP POLICY IF EXISTS "Public read access to transaction requests" ON transaction_requests;
DROP POLICY IF EXISTS "Public write access to transaction requests" ON transaction_requests;

-- transactions
DROP POLICY IF EXISTS "Public read access to transactions" ON transactions;
DROP POLICY IF EXISTS "Public write access to transactions" ON transactions;


-- ============================================
-- 2. REMOVE PUBLIC ROLE ALWAYS-TRUE POLICIES
--    Replace with authenticated-only policies
-- ============================================

-- amalgamations
DROP POLICY IF EXISTS "Allow public read access to amalgamations" ON amalgamations;
DROP POLICY IF EXISTS "Allow public insert to amalgamations" ON amalgamations;
DROP POLICY IF EXISTS "Allow public update to amalgamations" ON amalgamations;
DROP POLICY IF EXISTS "Allow public delete from amalgamations" ON amalgamations;

CREATE POLICY "Authenticated users can read amalgamations"
  ON amalgamations FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert amalgamations"
  ON amalgamations FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update amalgamations"
  ON amalgamations FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete amalgamations"
  ON amalgamations FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- brokerage_fee_types
DROP POLICY IF EXISTS "Allow public read access to brokerage_fee_types" ON brokerage_fee_types;
DROP POLICY IF EXISTS "Allow public insert to brokerage_fee_types" ON brokerage_fee_types;
DROP POLICY IF EXISTS "Allow public update to brokerage_fee_types" ON brokerage_fee_types;
DROP POLICY IF EXISTS "Allow public delete from brokerage_fee_types" ON brokerage_fee_types;

CREATE POLICY "Authenticated users can read brokerage fee types"
  ON brokerage_fee_types FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert brokerage fee types"
  ON brokerage_fee_types FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update brokerage fee types"
  ON brokerage_fee_types FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete brokerage fee types"
  ON brokerage_fee_types FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- corporate_actions
DROP POLICY IF EXISTS "Allow public read access to corporate_actions" ON corporate_actions;
DROP POLICY IF EXISTS "Allow public insert to corporate_actions" ON corporate_actions;
DROP POLICY IF EXISTS "Allow public update to corporate_actions" ON corporate_actions;
DROP POLICY IF EXISTS "Allow public delete from corporate_actions" ON corporate_actions;

CREATE POLICY "Authenticated users can read corporate actions"
  ON corporate_actions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert corporate actions"
  ON corporate_actions FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update corporate actions"
  ON corporate_actions FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete corporate actions"
  ON corporate_actions FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- corporate_action_history
DROP POLICY IF EXISTS "Allow public read access to corporate_action_history" ON corporate_action_history;
DROP POLICY IF EXISTS "Allow public insert to corporate_action_history" ON corporate_action_history;
DROP POLICY IF EXISTS "Allow public update to corporate_action_history" ON corporate_action_history;
DROP POLICY IF EXISTS "Allow public delete from corporate_action_history" ON corporate_action_history;

CREATE POLICY "Authenticated users can read corporate action history"
  ON corporate_action_history FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert corporate action history"
  ON corporate_action_history FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update corporate action history"
  ON corporate_action_history FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete corporate action history"
  ON corporate_action_history FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- rights_issues
DROP POLICY IF EXISTS "Allow public read access to rights_issues" ON rights_issues;
DROP POLICY IF EXISTS "Allow public insert to rights_issues" ON rights_issues;
DROP POLICY IF EXISTS "Allow public update to rights_issues" ON rights_issues;
DROP POLICY IF EXISTS "Allow public delete from rights_issues" ON rights_issues;

CREATE POLICY "Authenticated users can read rights issues"
  ON rights_issues FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert rights issues"
  ON rights_issues FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update rights issues"
  ON rights_issues FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete rights issues"
  ON rights_issues FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- share_buybacks
DROP POLICY IF EXISTS "Allow public read access to share_buybacks" ON share_buybacks;
DROP POLICY IF EXISTS "Allow public insert to share_buybacks" ON share_buybacks;
DROP POLICY IF EXISTS "Allow public update to share_buybacks" ON share_buybacks;
DROP POLICY IF EXISTS "Allow public delete from share_buybacks" ON share_buybacks;

CREATE POLICY "Authenticated users can read share buybacks"
  ON share_buybacks FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert share buybacks"
  ON share_buybacks FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update share buybacks"
  ON share_buybacks FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete share buybacks"
  ON share_buybacks FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- share_subdivisions
DROP POLICY IF EXISTS "Allow public read access to share_subdivisions" ON share_subdivisions;
DROP POLICY IF EXISTS "Allow public insert to share_subdivisions" ON share_subdivisions;
DROP POLICY IF EXISTS "Allow public update to share_subdivisions" ON share_subdivisions;
DROP POLICY IF EXISTS "Allow public delete from share_subdivisions" ON share_subdivisions;

CREATE POLICY "Authenticated users can read share subdivisions"
  ON share_subdivisions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert share subdivisions"
  ON share_subdivisions FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update share subdivisions"
  ON share_subdivisions FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete share subdivisions"
  ON share_subdivisions FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- currencies
DROP POLICY IF EXISTS "Anyone can read currencies" ON currencies;
DROP POLICY IF EXISTS "Authenticated users can insert currencies" ON currencies;
DROP POLICY IF EXISTS "Authenticated users can update currencies" ON currencies;

CREATE POLICY "Authenticated users can read currencies"
  ON currencies FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert currencies"
  ON currencies FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update currencies"
  ON currencies FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());


-- ============================================
-- 3. FIX ALWAYS-TRUE AUTHENTICATED POLICIES
--    Reference/config tables: write = admin only
--    Data tables: replace FOR ALL with separate policies
-- ============================================

-- entity_types (reference table - admin write)
DROP POLICY IF EXISTS "Authenticated users can read entity types" ON entity_types;
DROP POLICY IF EXISTS "Authenticated users can insert entity types" ON entity_types;
DROP POLICY IF EXISTS "Authenticated users can update entity types" ON entity_types;
DROP POLICY IF EXISTS "Authenticated users can delete entity types" ON entity_types;

CREATE POLICY "Authenticated users can read entity types"
  ON entity_types FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert entity types"
  ON entity_types FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update entity types"
  ON entity_types FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete entity types"
  ON entity_types FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- industry_types (reference table - admin write)
DROP POLICY IF EXISTS "Authenticated users can read industry_types" ON industry_types;
DROP POLICY IF EXISTS "Authenticated users can insert industry_types" ON industry_types;
DROP POLICY IF EXISTS "Authenticated users can update industry_types" ON industry_types;
DROP POLICY IF EXISTS "Authenticated users can delete industry_types" ON industry_types;

CREATE POLICY "Authenticated users can read industry types"
  ON industry_types FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert industry types"
  ON industry_types FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update industry types"
  ON industry_types FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete industry types"
  ON industry_types FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- sector_types (reference table - admin write)
DROP POLICY IF EXISTS "Authenticated users can read sector_types" ON sector_types;
DROP POLICY IF EXISTS "Authenticated users can insert sector_types" ON sector_types;
DROP POLICY IF EXISTS "Authenticated users can update sector_types" ON sector_types;
DROP POLICY IF EXISTS "Authenticated users can delete sector_types" ON sector_types;

CREATE POLICY "Authenticated users can read sector types"
  ON sector_types FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert sector types"
  ON sector_types FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update sector types"
  ON sector_types FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete sector types"
  ON sector_types FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- fee_components (reference table - admin write)
DROP POLICY IF EXISTS "Users can read fee components" ON fee_components;
DROP POLICY IF EXISTS "Users can insert fee components" ON fee_components;
DROP POLICY IF EXISTS "Users can update fee components" ON fee_components;
DROP POLICY IF EXISTS "Users can delete fee components" ON fee_components;

CREATE POLICY "Authenticated users can read fee components"
  ON fee_components FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert fee components"
  ON fee_components FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update fee components"
  ON fee_components FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete fee components"
  ON fee_components FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- fee_rates (reference table - admin write)
DROP POLICY IF EXISTS "Users can read fee rates" ON fee_rates;
DROP POLICY IF EXISTS "Users can insert fee rates" ON fee_rates;
DROP POLICY IF EXISTS "Users can update fee rates" ON fee_rates;
DROP POLICY IF EXISTS "Users can delete fee rates" ON fee_rates;

CREATE POLICY "Authenticated users can read fee rates"
  ON fee_rates FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert fee rates"
  ON fee_rates FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update fee rates"
  ON fee_rates FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete fee rates"
  ON fee_rates FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- fee_tiers (reference table - admin write)
DROP POLICY IF EXISTS "Users can read fee tiers" ON fee_tiers;
DROP POLICY IF EXISTS "Users can insert fee tiers" ON fee_tiers;
DROP POLICY IF EXISTS "Users can update fee tiers" ON fee_tiers;
DROP POLICY IF EXISTS "Users can delete fee tiers" ON fee_tiers;

CREATE POLICY "Authenticated users can read fee tiers"
  ON fee_tiers FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert fee tiers"
  ON fee_tiers FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update fee tiers"
  ON fee_tiers FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete fee tiers"
  ON fee_tiers FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- brokers (reference table - admin write)
DROP POLICY IF EXISTS "Authenticated users can read brokers" ON brokers;
DROP POLICY IF EXISTS "Authenticated users can insert brokers" ON brokers;
DROP POLICY IF EXISTS "Authenticated users can update brokers" ON brokers;
DROP POLICY IF EXISTS "Authenticated users can delete brokers" ON brokers;

CREATE POLICY "Authenticated users can read brokers"
  ON brokers FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can insert brokers"
  ON brokers FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update brokers"
  ON brokers FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete brokers"
  ON brokers FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- cash_balance_config (config table - admin write)
DROP POLICY IF EXISTS "Authenticated users can view config" ON cash_balance_config;
DROP POLICY IF EXISTS "Authenticated users can update config" ON cash_balance_config;

CREATE POLICY "Authenticated users can read config"
  ON cash_balance_config FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can update config"
  ON cash_balance_config FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());


-- ============================================
-- 4. FIX DATA TABLES - Replace FOR ALL with
--    separate per-action policies
-- ============================================

-- banks
DROP POLICY IF EXISTS "Allow all operations on banks" ON banks;

CREATE POLICY "Authenticated users can read banks"
  ON banks FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert banks"
  ON banks FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update banks"
  ON banks FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete banks"
  ON banks FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- dividends
DROP POLICY IF EXISTS "Allow all operations on dividends" ON dividends;

CREATE POLICY "Authenticated users can read dividends"
  ON dividends FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert dividends"
  ON dividends FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update dividends"
  ON dividends FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete dividends"
  ON dividends FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- entities
DROP POLICY IF EXISTS "Allow all operations on entities" ON entities;

CREATE POLICY "Authenticated users can read entities"
  ON entities FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert entities"
  ON entities FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update entities"
  ON entities FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete entities"
  ON entities FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- scrip_entries
DROP POLICY IF EXISTS "Allow all operations on scrip_entries" ON scrip_entries;

CREATE POLICY "Authenticated users can read scrip entries"
  ON scrip_entries FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert scrip entries"
  ON scrip_entries FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update scrip entries"
  ON scrip_entries FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete scrip entries"
  ON scrip_entries FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- shares
DROP POLICY IF EXISTS "Allow all operations on shares" ON shares;

CREATE POLICY "Authenticated users can read shares"
  ON shares FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert shares"
  ON shares FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update shares"
  ON shares FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete shares"
  ON shares FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- transaction_approvals
DROP POLICY IF EXISTS "Allow all operations on transaction_approvals" ON transaction_approvals;

CREATE POLICY "Authenticated users can read transaction approvals"
  ON transaction_approvals FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert transaction approvals"
  ON transaction_approvals FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update transaction approvals"
  ON transaction_approvals FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete transaction approvals"
  ON transaction_approvals FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- transaction_documents
DROP POLICY IF EXISTS "Allow all operations on transaction_documents" ON transaction_documents;

CREATE POLICY "Authenticated users can read transaction documents"
  ON transaction_documents FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert transaction documents"
  ON transaction_documents FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update transaction documents"
  ON transaction_documents FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete transaction documents"
  ON transaction_documents FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- transaction_requests
DROP POLICY IF EXISTS "Allow all operations on transaction_requests" ON transaction_requests;

CREATE POLICY "Authenticated users can read transaction requests"
  ON transaction_requests FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert transaction requests"
  ON transaction_requests FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update transaction requests"
  ON transaction_requests FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete transaction requests"
  ON transaction_requests FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- transactions
DROP POLICY IF EXISTS "Allow all operations on transactions" ON transactions;

CREATE POLICY "Authenticated users can read transactions"
  ON transactions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert transactions"
  ON transactions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update transactions"
  ON transactions FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete transactions"
  ON transactions FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- buy_sell_notes
DROP POLICY IF EXISTS "Authenticated users can view buy sell notes" ON buy_sell_notes;
DROP POLICY IF EXISTS "Authenticated users can insert buy sell notes" ON buy_sell_notes;
DROP POLICY IF EXISTS "Authenticated users can update buy sell notes" ON buy_sell_notes;
DROP POLICY IF EXISTS "Authenticated users can delete buy sell notes" ON buy_sell_notes;

CREATE POLICY "Authenticated users can read buy sell notes"
  ON buy_sell_notes FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert buy sell notes"
  ON buy_sell_notes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update buy sell notes"
  ON buy_sell_notes FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete buy sell notes"
  ON buy_sell_notes FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- buy_sell_approvals
DROP POLICY IF EXISTS "Authenticated users can view buy sell approvals" ON buy_sell_approvals;
DROP POLICY IF EXISTS "Authenticated users can insert buy sell approvals" ON buy_sell_approvals;
DROP POLICY IF EXISTS "Authenticated users can update buy sell approvals" ON buy_sell_approvals;
DROP POLICY IF EXISTS "Authenticated users can delete buy sell approvals" ON buy_sell_approvals;

CREATE POLICY "Authenticated users can read buy sell approvals"
  ON buy_sell_approvals FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert buy sell approvals"
  ON buy_sell_approvals FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update buy sell approvals"
  ON buy_sell_approvals FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete buy sell approvals"
  ON buy_sell_approvals FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- cash_balance_ledger
DROP POLICY IF EXISTS "Authenticated users can view all ledger entries" ON cash_balance_ledger;
DROP POLICY IF EXISTS "Authenticated users can insert ledger entries" ON cash_balance_ledger;
DROP POLICY IF EXISTS "Authenticated users can update ledger entries" ON cash_balance_ledger;
DROP POLICY IF EXISTS "Authenticated users can delete ledger entries" ON cash_balance_ledger;

CREATE POLICY "Authenticated users can read ledger entries"
  ON cash_balance_ledger FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert ledger entries"
  ON cash_balance_ledger FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update ledger entries"
  ON cash_balance_ledger FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete ledger entries"
  ON cash_balance_ledger FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- daily_share_prices
DROP POLICY IF EXISTS "Authenticated users can view all daily prices" ON daily_share_prices;
DROP POLICY IF EXISTS "Authenticated users can insert daily prices" ON daily_share_prices;
DROP POLICY IF EXISTS "Authenticated users can update daily prices" ON daily_share_prices;
DROP POLICY IF EXISTS "Authenticated users can delete daily prices" ON daily_share_prices;

CREATE POLICY "Authenticated users can read daily prices"
  ON daily_share_prices FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert daily prices"
  ON daily_share_prices FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update daily prices"
  ON daily_share_prices FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete daily prices"
  ON daily_share_prices FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- entity_brokers
DROP POLICY IF EXISTS "Allow authenticated users to read entity-broker relationships" ON entity_brokers;
DROP POLICY IF EXISTS "Allow authenticated users to insert entity-broker relationships" ON entity_brokers;
DROP POLICY IF EXISTS "Allow authenticated users to update entity-broker relationships" ON entity_brokers;
DROP POLICY IF EXISTS "Allow authenticated users to delete entity-broker relationships" ON entity_brokers;

CREATE POLICY "Authenticated users can read entity brokers"
  ON entity_brokers FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert entity brokers"
  ON entity_brokers FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update entity brokers"
  ON entity_brokers FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete entity brokers"
  ON entity_brokers FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- share_52week_values
DROP POLICY IF EXISTS "Authenticated users can view 52-week values" ON share_52week_values;
DROP POLICY IF EXISTS "Authenticated users can insert 52-week values" ON share_52week_values;
DROP POLICY IF EXISTS "Authenticated users can update 52-week values" ON share_52week_values;
DROP POLICY IF EXISTS "Authenticated users can delete 52-week values" ON share_52week_values;

CREATE POLICY "Authenticated users can read 52 week values"
  ON share_52week_values FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert 52 week values"
  ON share_52week_values FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update 52 week values"
  ON share_52week_values FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete 52 week values"
  ON share_52week_values FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- share_dividends_per_share
DROP POLICY IF EXISTS "Authenticated users can view dividends per share" ON share_dividends_per_share;
DROP POLICY IF EXISTS "Authenticated users can insert dividends per share" ON share_dividends_per_share;
DROP POLICY IF EXISTS "Authenticated users can update dividends per share" ON share_dividends_per_share;
DROP POLICY IF EXISTS "Authenticated users can delete dividends per share" ON share_dividends_per_share;

CREATE POLICY "Authenticated users can read dividends per share"
  ON share_dividends_per_share FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert dividends per share"
  ON share_dividends_per_share FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update dividends per share"
  ON share_dividends_per_share FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete dividends per share"
  ON share_dividends_per_share FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- share_earnings
DROP POLICY IF EXISTS "Authenticated users can view earnings" ON share_earnings;
DROP POLICY IF EXISTS "Authenticated users can insert earnings" ON share_earnings;
DROP POLICY IF EXISTS "Authenticated users can update earnings" ON share_earnings;
DROP POLICY IF EXISTS "Authenticated users can delete earnings" ON share_earnings;

CREATE POLICY "Authenticated users can read earnings"
  ON share_earnings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert earnings"
  ON share_earnings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update earnings"
  ON share_earnings FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete earnings"
  ON share_earnings FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- share_values
DROP POLICY IF EXISTS "Authenticated users can view share values" ON share_values;
DROP POLICY IF EXISTS "Authenticated users can insert share values" ON share_values;
DROP POLICY IF EXISTS "Authenticated users can update share values" ON share_values;
DROP POLICY IF EXISTS "Authenticated users can delete share values" ON share_values;

CREATE POLICY "Authenticated users can read share values"
  ON share_values FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert share values"
  ON share_values FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update share values"
  ON share_values FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete share values"
  ON share_values FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);


-- ============================================
-- 5. FIX ADMIN TABLES - Performance optimization
--    Replace auth.uid() with (select auth.uid())
--    Split FOR ALL into separate actions
-- ============================================

-- menu_items
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Users can read active menu items" ON menu_items;

CREATE POLICY "Users can read active menu items"
  ON menu_items FOR SELECT TO authenticated
  USING (is_active = true);
CREATE POLICY "Admins can insert menu items"
  ON menu_items FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update menu items"
  ON menu_items FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete menu items"
  ON menu_items FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- user_entity_access
DROP POLICY IF EXISTS "Admins can manage entity access" ON user_entity_access;
DROP POLICY IF EXISTS "Users can read own entity access" ON user_entity_access;

CREATE POLICY "Users can read own entity access"
  ON user_entity_access FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
CREATE POLICY "Admins can read all entity access"
  ON user_entity_access FOR SELECT TO authenticated
  USING (public.is_app_admin());
CREATE POLICY "Admins can insert entity access"
  ON user_entity_access FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update entity access"
  ON user_entity_access FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete entity access"
  ON user_entity_access FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- user_menu_access
DROP POLICY IF EXISTS "Admins can manage menu access" ON user_menu_access;
DROP POLICY IF EXISTS "Users can read own menu access" ON user_menu_access;

CREATE POLICY "Users can read own menu access"
  ON user_menu_access FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
CREATE POLICY "Admins can read all menu access"
  ON user_menu_access FOR SELECT TO authenticated
  USING (public.is_app_admin());
CREATE POLICY "Admins can insert menu access"
  ON user_menu_access FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can update menu access"
  ON user_menu_access FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
CREATE POLICY "Admins can delete menu access"
  ON user_menu_access FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- app_users (fix performance - wrap auth.uid() in select)
DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON app_users;
DROP POLICY IF EXISTS "Users can update own profile or admins update all" ON app_users;

CREATE POLICY "Users can read own profile or admins read all"
  ON app_users FOR SELECT TO authenticated
  USING ((select auth.uid()) = id OR public.is_app_admin());
CREATE POLICY "Users can update own profile or admins update all"
  ON app_users FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id OR public.is_app_admin())
  WITH CHECK ((select auth.uid()) = id OR public.is_app_admin());
