/*
  # F6: Stop users promoting themselves to administrator

  app_users.UPDATE is scoped to the caller's own row, but the grant covered
  every column, so a user could PATCH their own row with {"role":"admin"}.
  is_app_admin() reads exactly that column, so this was a full escalation.

  Row-level rules cannot protect a column, so restrict at the column level:
  users may only change their own display name. Role and activation changes
  move to admin-only paths.

  SELECT is deliberately left untouched so existing select('*') queries keep
  working.
*/

-- Only the profile fields a user may maintain themselves stay writable.
REVOKE UPDATE ON public.app_users FROM authenticated;
REVOKE UPDATE ON public.app_users FROM anon;
REVOKE INSERT, DELETE ON public.app_users FROM authenticated;
REVOKE INSERT, DELETE ON public.app_users FROM anon;

GRANT UPDATE (full_name, updated_at) ON public.app_users TO authenticated;

-- Admin-only role change, so the User Management screen keeps working.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Only administrators can change user roles';
  END IF;

  IF p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_user_id = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Administrators cannot remove their own admin role';
  END IF;

  UPDATE public.app_users
  SET role = p_role, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
