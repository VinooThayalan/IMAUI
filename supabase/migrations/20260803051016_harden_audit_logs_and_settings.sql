/*
  # F13, F14, F15: Protect the audit trail

  F13 - audit_logs had UPDATE and DELETE policies for authenticated users, so
        anyone could rewrite or erase the record of their own actions.
  F14 - audit_settings (the on/off switch for logging) was updatable by any
        signed-in user, letting them disable logging before acting.
  F15 - performed_by came straight from the browser, so an entry could be
        attributed to somebody else. A BEFORE INSERT trigger now overwrites it
        with the authenticated caller's email.
*/

-- F13: the audit trail is append-only
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs'
      AND cmd IN ('UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', p.policyname);
  END LOOP;
END $$;

REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;

-- F15: attribution is set server-side from the session
CREATE OR REPLACE FUNCTION public.set_audit_log_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.performed_by := COALESCE(
    NULLIF((select auth.jwt() ->> 'email'), ''),
    (select auth.uid())::text,
    'system'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_audit_log_actor_trg ON public.audit_logs;
CREATE TRIGGER set_audit_log_actor_trg
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_actor();

-- F14: only administrators can change audit settings
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_settings'
      AND cmd IN ('UPDATE', 'INSERT', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_settings', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can insert audit settings"
  ON public.audit_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Admins can update audit settings"
  ON public.audit_settings FOR UPDATE TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE POLICY "Admins can delete audit settings"
  ON public.audit_settings FOR DELETE TO authenticated
  USING (public.is_app_admin());
