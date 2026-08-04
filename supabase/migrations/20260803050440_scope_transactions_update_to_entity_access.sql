/*
  # F9: Scope transaction updates to entities the user may access

  The authenticated UPDATE policy was USING (true) WITH CHECK (true), so any
  signed-in user could edit any entity's trades, including approval_status.
  The table's other verbs already use has_entity_access(entity_id); bring
  UPDATE in line with them. Admins continue to pass via is_app_admin() inside
  has_entity_access.
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transactions'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can update transactions for their entities"
  ON public.transactions
  FOR UPDATE
  TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
