/*
  # Fix entity_brokers SELECT RLS policy

  ## Problem
  The SELECT policy on entity_brokers requires has_entity_access(entity_id),
  which blocks users without explicit user_entity_access records from reading
  assigned brokers/custodians. After inserting, users cannot see the record.

  ## Change
  Replace the restrictive SELECT policy with an authenticated-user policy,
  consistent with the INSERT/UPDATE/DELETE policies and other tables.
*/

DROP POLICY IF EXISTS "Users can read entity brokers for accessible entities" ON entity_brokers;

CREATE POLICY "Authenticated users can read entity brokers"
  ON entity_brokers FOR SELECT TO authenticated USING (true);
