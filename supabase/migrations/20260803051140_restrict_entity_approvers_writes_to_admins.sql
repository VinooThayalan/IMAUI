/*
  # F16: Only administrators can appoint approvers

  entity_approvers decides who may approve a trade. Its write policies allowed
  any signed-in user, so a user could add themselves as an approver for any
  entity and then approve their own transactions. Reads stay open to signed-in
  users so approval screens keep working.
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'entity_approvers'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.entity_approvers', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can add approvers"
  ON public.entity_approvers FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Admins can update approvers"
  ON public.entity_approvers FOR UPDATE TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE POLICY "Admins can remove approvers"
  ON public.entity_approvers FOR DELETE TO authenticated
  USING (public.is_app_admin());
