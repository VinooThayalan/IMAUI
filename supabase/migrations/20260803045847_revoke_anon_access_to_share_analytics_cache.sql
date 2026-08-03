/*
  # F3: Remove unauthenticated access to the share analytics cache

  Holds per-share cost, dividends and surplus per entity. Written only from a
  signed-in session by the Share Analytics page, so the authenticated policies
  are sufficient.
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'share_analytics_cache' AND roles = '{anon}'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.share_analytics_cache', p.policyname);
  END LOOP;
END $$;
