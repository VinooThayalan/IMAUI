/*
  # Fix infinite recursion in app_users RLS policies

  1. Problem
    - The "Admins can read all users" and "Admins can update all users" policies
      query the app_users table to check if the current user is an admin
    - This triggers the same RLS policies again, causing infinite recursion (error 42P17)

  2. Solution
    - Create a SECURITY DEFINER function `is_app_admin()` that bypasses RLS
      to check if the current user has role = 'admin' in app_users
    - Drop the recursive policies and replace them with policies that use this function
    - Also drop the now-redundant "Users can view/update own profile" policies since
      the new admin policies already include the auth.uid() = id check

  3. Security
    - The helper function is SECURITY DEFINER so it runs with elevated privileges
      but only returns a boolean and cannot be exploited
    - All policies still require authentication
*/

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can read all users" ON app_users;
DROP POLICY IF EXISTS "Admins can update all users" ON app_users;
DROP POLICY IF EXISTS "Users can view their own profile" ON app_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON app_users;

CREATE POLICY "Users can read own profile or admins read all"
  ON app_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_app_admin());

CREATE POLICY "Users can update own profile or admins update all"
  ON app_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_app_admin())
  WITH CHECK (auth.uid() = id OR public.is_app_admin());
