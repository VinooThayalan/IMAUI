/*
  # Create Admin & Permission Management System

  1. Modified Tables
    - `app_users`
      - Added `role` column (text, default 'user') - either 'admin' or 'user'
      - Added `is_active` column (boolean, default true) - whether user can log in

  2. New Tables
    - `menu_items`
      - `id` (uuid, primary key)
      - `menu_name` (text, unique) - matches the hash route name used in navigation
      - `label` (text) - display label for the menu item
      - `section` (text) - which sidebar section this belongs to (Main, Master Data, Configurations, System, Admin)
      - `sort_order` (integer) - ordering within section
      - `is_active` (boolean) - whether this menu is available
      - `created_at` (timestamptz)

    - `user_menu_access`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to app_users)
      - `menu_item_id` (uuid, FK to menu_items)
      - `created_at` (timestamptz)
      - Unique constraint on (user_id, menu_item_id)

    - `user_entity_access`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to app_users)
      - `entity_id` (uuid, FK to entities)
      - `created_at` (timestamptz)
      - Unique constraint on (user_id, entity_id)

  3. Security
    - RLS enabled on all new tables
    - Admin users can manage all permission tables
    - Regular users can only read their own access records

  4. Seed Data
    - 30 menu items covering all application pages
    - Existing users are set to 'admin' role by default

  5. Important Notes
    - Admin users bypass menu/entity restrictions and see everything
    - Regular users only see menus and entities explicitly granted to them
    - The handle_new_user trigger is updated to include role default
*/

-- Add role and is_active columns to app_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE app_users ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE app_users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Set all existing users to admin role
UPDATE app_users SET role = 'admin' WHERE role = 'user';

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_name text UNIQUE NOT NULL,
  label text NOT NULL,
  section text NOT NULL DEFAULT 'Main',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Create user_menu_access table
CREATE TABLE IF NOT EXISTS user_menu_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, menu_item_id)
);

ALTER TABLE user_menu_access ENABLE ROW LEVEL SECURITY;

-- Create user_entity_access table
CREATE TABLE IF NOT EXISTS user_entity_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_id)
);

ALTER TABLE user_entity_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_items
CREATE POLICY "Admins can manage menu items"
  ON menu_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  );

CREATE POLICY "Users can read active menu items"
  ON menu_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for user_menu_access
CREATE POLICY "Admins can manage menu access"
  ON user_menu_access
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  );

CREATE POLICY "Users can read own menu access"
  ON user_menu_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for user_entity_access
CREATE POLICY "Admins can manage entity access"
  ON user_entity_access
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  );

CREATE POLICY "Users can read own entity access"
  ON user_entity_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for app_users updates (admin can manage all users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all users' AND tablename = 'app_users'
  ) THEN
    CREATE POLICY "Admins can read all users"
      ON app_users
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM app_users au
          WHERE au.id = auth.uid()
          AND au.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update all users' AND tablename = 'app_users'
  ) THEN
    CREATE POLICY "Admins can update all users"
      ON app_users
      FOR UPDATE
      TO authenticated
      USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM app_users au
          WHERE au.id = auth.uid()
          AND au.role = 'admin'
        )
      )
      WITH CHECK (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM app_users au
          WHERE au.id = auth.uid()
          AND au.role = 'admin'
        )
      );
  END IF;
END $$;

-- Seed menu items
INSERT INTO menu_items (menu_name, label, section, sort_order) VALUES
  ('dashboard', 'Dashboard', 'Main', 1),
  ('transactions', 'Transactions', 'Main', 2),
  ('ipo-transactions', 'IPO Transactions', 'Main', 3),
  ('transaction-approvals', 'Transaction Approvals', 'Main', 4),
  ('buy-sell-notes', 'Buy & Sell Notes', 'Main', 5),
  ('buy-sell-approvals', 'Buy & Sell Approvals', 'Main', 6),
  ('cash-balance', 'Cash Balance', 'Main', 7),
  ('scrip-entry', 'Scrip Entry', 'Main', 8),
  ('dividends', 'Dividends', 'Main', 9),
  ('rights-issues', 'Rights Issues', 'Main', 10),
  ('amalgamations', 'Amalgamations', 'Main', 11),
  ('share-buybacks', 'Share Buybacks', 'Main', 12),
  ('share-subdivisions', 'Share Subdivisions', 'Main', 13),
  ('daily-prices', 'Daily Prices', 'Main', 14),
  ('share-analytics', 'Share Analytics', 'Main', 15),
  ('portfolio', 'Portfolio', 'Main', 16),
  ('entities', 'Entities', 'Master Data', 17),
  ('shares', 'Shares', 'Master Data', 18),
  ('banks', 'Banks', 'Master Data', 19),
  ('brokers', 'Brokers', 'Master Data', 20),
  ('entity-types', 'Entity Types', 'Configurations', 21),
  ('brokerage-fee-types', 'Brokerage Fee Types', 'Configurations', 22),
  ('industry-types', 'Industry Types', 'Configurations', 23),
  ('sector-types', 'Sector Types', 'Configurations', 24),
  ('reports', 'Reports', 'System', 25),
  ('portfolio-summary', 'Portfolio Summary', 'System', 26),
  ('settings', 'Settings', 'System', 27),
  ('user-management', 'User Management', 'Admin', 28),
  ('menu-access', 'Menu Access', 'Admin', 29),
  ('entity-access', 'Entity Access', 'Admin', 30)
ON CONFLICT (menu_name) DO NOTHING;

-- Update handle_new_user function to include role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.app_users (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;