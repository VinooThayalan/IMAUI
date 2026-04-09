/*
  # Fix Banks and Brokers RLS Policies

  ## Problem
  1. Brokers: INSERT/UPDATE/DELETE policies restrict to is_app_admin() only,
     blocking all regular authenticated users from managing brokers.
  2. Banks: INSERT policy uses has_entity_access(entity_id) which can block
     inserts when entity access records are missing.

  ## Changes
  - Brokers: Replace admin-only write policies with authenticated-user policies
  - Banks: Replace entity-access-gated write policies with authenticated-user policies
    (banks are master data that should be manageable by any logged-in user)
*/

-- Drop old broker write policies
DROP POLICY IF EXISTS "Admins can insert brokers" ON brokers;
DROP POLICY IF EXISTS "Admins can update brokers" ON brokers;
DROP POLICY IF EXISTS "Admins can delete brokers" ON brokers;

-- New broker write policies: any authenticated user
CREATE POLICY "Authenticated users can insert brokers"
  ON brokers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update brokers"
  ON brokers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete brokers"
  ON brokers FOR DELETE
  TO authenticated
  USING (true);

-- Drop old bank write policies
DROP POLICY IF EXISTS "Users can insert banks for accessible entities" ON banks;
DROP POLICY IF EXISTS "Users can update banks for accessible entities" ON banks;
DROP POLICY IF EXISTS "Users can delete banks for accessible entities" ON banks;
DROP POLICY IF EXISTS "Users can read banks for accessible entities" ON banks;

-- New bank policies: any authenticated user
CREATE POLICY "Authenticated users can read banks"
  ON banks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert banks"
  ON banks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update banks"
  ON banks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete banks"
  ON banks FOR DELETE
  TO authenticated
  USING (true);
