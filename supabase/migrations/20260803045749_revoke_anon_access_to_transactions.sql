/*
  # F1: Remove unauthenticated access to transactions

  The anon role could read, insert, update and delete every transaction.
  The anon key ships in the browser bundle, so these policies exposed the
  whole transactions table to the internet. The authenticated policies
  already scope access with has_entity_access(entity_id).
*/

DROP POLICY IF EXISTS "Anon users can read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anon users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anon users can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anon users can delete transactions" ON public.transactions;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transactions' AND roles = '{anon}'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', p.policyname);
  END LOOP;
END $$;
