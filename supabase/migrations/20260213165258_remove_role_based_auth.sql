/*
  # Remove Role-Based Authentication and Simplify Schema

  This migration simplifies the authentication system by removing role-based access control.
  All authenticated users will have full access to the application.

  1. Changes to Tables
    - Drop `user_entity_access` table (no longer needed)
    - Drop `user_menu_access` table (no longer needed)
    - Drop `menu_items` table (no longer needed)
    - Simplify `app_users` table:
      - Remove `role` column
      - Remove `is_active` column
      - Keep only basic user information

  2. Security Changes
    - Remove all role-based RLS policies
    - Add simple policies allowing all authenticated users to access their data
    - Remove super admin specific policies

  3. Function Updates
    - Update `handle_new_user()` function to not include role
*/

-- Drop existing policies on app_users
DROP POLICY IF EXISTS "Users can view their own profile" ON app_users;
DROP POLICY IF EXISTS "Super admins can view all users" ON app_users;
DROP POLICY IF EXISTS "Super admins can insert users" ON app_users;
DROP POLICY IF EXISTS "Super admins can update users" ON app_users;
DROP POLICY IF EXISTS "Super admins can delete users" ON app_users;

-- Drop user_entity_access table and its policies
DROP POLICY IF EXISTS "Users can view their own entity access" ON user_entity_access;
DROP POLICY IF EXISTS "Super admins can manage all entity access" ON user_entity_access;
DROP TABLE IF EXISTS user_entity_access;

-- Drop user_menu_access table and its policies
DROP POLICY IF EXISTS "Users can view their own menu access" ON user_menu_access;
DROP POLICY IF EXISTS "Super admins can manage all menu access" ON user_menu_access;
DROP TABLE IF EXISTS user_menu_access;

-- Drop menu_items table and its policies
DROP POLICY IF EXISTS "Anyone can view active menu items" ON menu_items;
DROP POLICY IF EXISTS "Super admins can manage menu items" ON menu_items;
DROP TABLE IF EXISTS menu_items;

-- Remove role and is_active columns from app_users
ALTER TABLE app_users DROP COLUMN IF EXISTS role;
ALTER TABLE app_users DROP COLUMN IF EXISTS is_active;

-- Add simple RLS policy for app_users (users can view their own profile)
CREATE POLICY "Users can view their own profile"
  ON app_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON app_users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Update the handle_new_user function to remove role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.app_users (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
