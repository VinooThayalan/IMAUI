/*
  # F5: Remove unauthenticated updates to the cash ledger

  An anon UPDATE policy with USING (true) allowed anyone to rewrite amounts
  and running balances without signing in. The other verbs on this table are
  already scoped with has_entity_access(entity_id).
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cash_balance_ledger' AND roles = '{anon}'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cash_balance_ledger', p.policyname);
  END LOOP;
END $$;
