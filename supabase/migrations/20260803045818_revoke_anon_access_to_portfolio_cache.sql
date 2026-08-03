/*
  # F2: Remove unauthenticated access to the portfolio cache

  The cache holds the same holdings, cost and market value figures that are
  protected by has_entity_access on the source tables. The app writes it only
  from a signed-in session, so the authenticated policies are sufficient.
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'portfolio_cache' AND roles = '{anon}'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.portfolio_cache', p.policyname);
  END LOOP;
END $$;
