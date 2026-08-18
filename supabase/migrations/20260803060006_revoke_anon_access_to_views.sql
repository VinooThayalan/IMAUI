/*
  Remove anonymous (unsigned) access from views in the public schema.

  20260803060001_revoke_all_anon_access sweeps
      information_schema.tables WHERE table_type = 'BASE TABLE'
  so views were never included, and anon kept the grants it receives from this
  database's default privileges (anon = arwdDxtm on new objects in public).
  fee_tier_summary was left with SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
  REFERENCES and TRIGGER granted to anon.

  Scope of the actual exposure: low. fee_tier_summary is defined with
  security_invoker = true (set by 20260401200344_fix_security_definer_view), so it
  executes with the caller's privileges rather than the owner's. anon is therefore
  still blocked by the underlying tables:

      set role anon; select count(*) from public.fee_tier_summary;
      ERROR: permission denied for table fee_tiers

  The view also contains GROUP BY, so it is not automatically updatable and the
  write grants cannot be exercised either.

  This is hygiene rather than an active fix: it removes grants that were never
  intended, and closes the gap that would open if the view were ever changed to
  security_definer, or if anon were granted access to an underlying table.

  Written as a loop rather than naming fee_tier_summary so that any view added
  later is covered too, matching how 20260803060001 handles base tables.
*/

DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v.table_name);
  END LOOP;
END $$;
