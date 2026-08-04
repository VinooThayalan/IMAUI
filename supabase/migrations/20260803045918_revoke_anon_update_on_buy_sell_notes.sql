/*
  # F4: Remove unauthenticated updates to contract notes

  An anon UPDATE policy with USING (true) allowed anyone to set a note's
  status to PROCESSED without signing in. The other verbs on this table are
  already scoped through transactions with has_entity_access.
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'buy_sell_notes' AND roles = '{anon}'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.buy_sell_notes', p.policyname);
  END LOOP;
END $$;
