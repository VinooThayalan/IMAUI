/*
  Remove all anonymous (unsigned) access from every table in the public schema.
  Previously anon had full CRUD on 30+ tables, meaning anyone on the internet
  could read and change trades, cash, contract notes, and portfolio data.
*/

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.table_name);
  END LOOP;
END $$;

-- Drop every policy that granted access to the anon role
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND '{anon}' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Revoke EXECUTE on helper functions from anon/PUBLIC
REVOKE ALL ON FUNCTION public.has_entity_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_entity_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- Revoke EXECUTE on the audit trigger function from everyone except service role
REVOKE ALL ON FUNCTION public.set_audit_log_actor() FROM PUBLIC, anon, authenticated;
