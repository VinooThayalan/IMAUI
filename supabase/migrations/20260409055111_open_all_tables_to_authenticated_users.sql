/*
  # Open All Master/Transaction Tables to Authenticated Users

  ## Problem
  Multiple tables have INSERT/UPDATE/DELETE policies that require is_app_admin(),
  blocking non-admin authenticated users from managing data across most menus.

  ## Affected Tables
  - amalgamations
  - brokerage_fee_types
  - entity_types
  - fee_components, fee_rates, fee_tiers
  - industry_types, sector_types
  - rights_issues, share_buybacks, share_subdivisions
  - currencies

  ## Change
  Replace admin-only write policies with authenticated-user write policies
  on all affected tables so any logged-in user can manage data.
*/

-- ===== AMALGAMATIONS =====
DROP POLICY IF EXISTS "Admins can insert amalgamations" ON amalgamations;
DROP POLICY IF EXISTS "Admins can update amalgamations" ON amalgamations;
DROP POLICY IF EXISTS "Admins can delete amalgamations" ON amalgamations;

CREATE POLICY "Authenticated users can insert amalgamations"
  ON amalgamations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update amalgamations"
  ON amalgamations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete amalgamations"
  ON amalgamations FOR DELETE TO authenticated USING (true);

-- ===== BROKERAGE FEE TYPES =====
DROP POLICY IF EXISTS "Admins can insert brokerage fee types" ON brokerage_fee_types;
DROP POLICY IF EXISTS "Admins can update brokerage fee types" ON brokerage_fee_types;
DROP POLICY IF EXISTS "Admins can delete brokerage fee types" ON brokerage_fee_types;

CREATE POLICY "Authenticated users can insert brokerage fee types"
  ON brokerage_fee_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update brokerage fee types"
  ON brokerage_fee_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete brokerage fee types"
  ON brokerage_fee_types FOR DELETE TO authenticated USING (true);

-- ===== ENTITY TYPES =====
DROP POLICY IF EXISTS "Admins can insert entity types" ON entity_types;
DROP POLICY IF EXISTS "Admins can update entity types" ON entity_types;
DROP POLICY IF EXISTS "Admins can delete entity types" ON entity_types;

CREATE POLICY "Authenticated users can insert entity types"
  ON entity_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update entity types"
  ON entity_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete entity types"
  ON entity_types FOR DELETE TO authenticated USING (true);

-- ===== FEE COMPONENTS =====
DROP POLICY IF EXISTS "Admins can insert fee components" ON fee_components;
DROP POLICY IF EXISTS "Admins can update fee components" ON fee_components;
DROP POLICY IF EXISTS "Admins can delete fee components" ON fee_components;

CREATE POLICY "Authenticated users can insert fee components"
  ON fee_components FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fee components"
  ON fee_components FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete fee components"
  ON fee_components FOR DELETE TO authenticated USING (true);

-- ===== FEE RATES =====
DROP POLICY IF EXISTS "Admins can insert fee rates" ON fee_rates;
DROP POLICY IF EXISTS "Admins can update fee rates" ON fee_rates;
DROP POLICY IF EXISTS "Admins can delete fee rates" ON fee_rates;

CREATE POLICY "Authenticated users can insert fee rates"
  ON fee_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fee rates"
  ON fee_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete fee rates"
  ON fee_rates FOR DELETE TO authenticated USING (true);

-- ===== FEE TIERS =====
DROP POLICY IF EXISTS "Admins can insert fee tiers" ON fee_tiers;
DROP POLICY IF EXISTS "Admins can update fee tiers" ON fee_tiers;
DROP POLICY IF EXISTS "Admins can delete fee tiers" ON fee_tiers;

CREATE POLICY "Authenticated users can insert fee tiers"
  ON fee_tiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fee tiers"
  ON fee_tiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete fee tiers"
  ON fee_tiers FOR DELETE TO authenticated USING (true);

-- ===== INDUSTRY TYPES =====
DROP POLICY IF EXISTS "Admins can insert industry types" ON industry_types;
DROP POLICY IF EXISTS "Admins can update industry types" ON industry_types;
DROP POLICY IF EXISTS "Admins can delete industry types" ON industry_types;

CREATE POLICY "Authenticated users can insert industry types"
  ON industry_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update industry types"
  ON industry_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete industry types"
  ON industry_types FOR DELETE TO authenticated USING (true);

-- ===== RIGHTS ISSUES =====
DROP POLICY IF EXISTS "Admins can insert rights issues" ON rights_issues;
DROP POLICY IF EXISTS "Admins can update rights issues" ON rights_issues;
DROP POLICY IF EXISTS "Admins can delete rights issues" ON rights_issues;

CREATE POLICY "Authenticated users can insert rights issues"
  ON rights_issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rights issues"
  ON rights_issues FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete rights issues"
  ON rights_issues FOR DELETE TO authenticated USING (true);

-- ===== SECTOR TYPES =====
DROP POLICY IF EXISTS "Admins can insert sector types" ON sector_types;
DROP POLICY IF EXISTS "Admins can update sector types" ON sector_types;
DROP POLICY IF EXISTS "Admins can delete sector types" ON sector_types;

CREATE POLICY "Authenticated users can insert sector types"
  ON sector_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sector types"
  ON sector_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete sector types"
  ON sector_types FOR DELETE TO authenticated USING (true);

-- ===== SHARE BUYBACKS =====
DROP POLICY IF EXISTS "Admins can insert share buybacks" ON share_buybacks;
DROP POLICY IF EXISTS "Admins can update share buybacks" ON share_buybacks;
DROP POLICY IF EXISTS "Admins can delete share buybacks" ON share_buybacks;

CREATE POLICY "Authenticated users can insert share buybacks"
  ON share_buybacks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update share buybacks"
  ON share_buybacks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete share buybacks"
  ON share_buybacks FOR DELETE TO authenticated USING (true);

-- ===== SHARE SUBDIVISIONS =====
DROP POLICY IF EXISTS "Admins can insert share subdivisions" ON share_subdivisions;
DROP POLICY IF EXISTS "Admins can update share subdivisions" ON share_subdivisions;
DROP POLICY IF EXISTS "Admins can delete share subdivisions" ON share_subdivisions;

CREATE POLICY "Authenticated users can insert share subdivisions"
  ON share_subdivisions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update share subdivisions"
  ON share_subdivisions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete share subdivisions"
  ON share_subdivisions FOR DELETE TO authenticated USING (true);

-- ===== CURRENCIES =====
DROP POLICY IF EXISTS "Admins can insert currencies" ON currencies;
DROP POLICY IF EXISTS "Admins can update currencies" ON currencies;
DROP POLICY IF EXISTS "Admins can delete currencies" ON currencies;

CREATE POLICY "Authenticated users can insert currencies"
  ON currencies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update currencies"
  ON currencies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete currencies"
  ON currencies FOR DELETE TO authenticated USING (true);
