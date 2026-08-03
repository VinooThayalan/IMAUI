/*
  # F12: Deactivated accounts must lose access

  app_users.is_active was loaded by the client but never enforced anywhere.
  Deactivating a user changed nothing: their session kept full access.
  Enforce it in the two functions every policy is built on.
*/

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_entity_access(p_entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    public.is_app_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.app_users
        WHERE id = (select auth.uid()) AND is_active = true
      )
      AND EXISTS (
        SELECT 1 FROM public.user_entity_access
        WHERE user_id = (select auth.uid())
          AND entity_id = p_entity_id
      )
    );
$function$;
