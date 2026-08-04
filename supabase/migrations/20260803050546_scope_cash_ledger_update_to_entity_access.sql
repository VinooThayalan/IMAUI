/*
  # F11: Scope cash ledger updates to entities the user may access

  The authenticated UPDATE policy was USING (true) WITH CHECK (true), so any
  signed-in user could rewrite another entity's amounts and running balances.
  The table's other verbs already use has_entity_access(entity_id).
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_balance_ledger'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cash_balance_ledger', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can update cash ledger for their entities"
  ON public.cash_balance_ledger
  FOR UPDATE
  TO authenticated
  USING (public.has_entity_access(entity_id))
  WITH CHECK (public.has_entity_access(entity_id));
