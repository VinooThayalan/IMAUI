/*
  # Fix entity_brokers RLS policies for authenticated users

  ## Problem
  The entity_brokers INSERT/UPDATE/DELETE policies use has_entity_access(entity_id)
  which requires a record in user_entity_access. Non-admin users without explicit
  entity access records cannot assign brokers/custodians, causing "Failed to assign
  broker" errors.

  ## Change
  Replace the has_entity_access-gated write policies with authenticated-user policies,
  consistent with the pattern used for all other tables in the application.
  The SELECT policy is kept as-is for read access control.
*/

DROP POLICY IF EXISTS "Users can insert entity brokers for accessible entities" ON entity_brokers;
DROP POLICY IF EXISTS "Users can update entity brokers for accessible entities" ON entity_brokers;
DROP POLICY IF EXISTS "Users can delete entity brokers for accessible entities" ON entity_brokers;

CREATE POLICY "Authenticated users can insert entity brokers"
  ON entity_brokers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update entity brokers"
  ON entity_brokers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete entity brokers"
  ON entity_brokers FOR DELETE TO authenticated USING (true);
