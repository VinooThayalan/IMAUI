/*
  # F7: Stop users granting themselves access to any entity

  user_entity_access had an INSERT policy WITH CHECK (user_id = auth.uid()).
  It bound only the user column to the session and left entity_id free, so a
  user could insert a row naming themselves against any entity and unlock it
  through has_entity_access. Entity access is an admin decision, and the
  admin-only INSERT policy on this table already covers the Entity Access
  screen.

  The self SELECT policy is kept so users can still see their own grants,
  which AuthContext reads on sign-in.
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, qual, with_check FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_entity_access'
      AND cmd = 'INSERT'
      AND with_check IS NOT NULL
      AND with_check NOT ILIKE '%is_app_admin%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_entity_access', p.policyname);
  END LOOP;
END $$;
