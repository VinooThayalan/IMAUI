/*
  # Authentication and Authorization Schema

  1. New Tables
    - `app_users`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `role` (text: super_admin, admin, manager)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `user_entity_access`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references app_users)
      - `entity_id` (uuid, references entities)
      - `can_view` (boolean)
      - `can_edit` (boolean)
      - `created_at` (timestamptz)
    
    - `menu_items`
      - `id` (uuid, primary key)
      - `name` (text) - internal identifier
      - `label` (text) - display name
      - `description` (text)
      - `is_active` (boolean)
      - `sort_order` (integer)
      - `created_at` (timestamptz)
    
    - `user_menu_access`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references app_users)
      - `menu_item_id` (uuid, references menu_items)
      - `granted_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
    - Super admin can manage all users and permissions
    - Users can read their own profile
*/

-- Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_entity_access table
CREATE TABLE IF NOT EXISTS user_entity_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_id)
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create user_menu_access table
CREATE TABLE IF NOT EXISTS user_menu_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, menu_item_id)
);

-- Insert default menu items
INSERT INTO menu_items (name, label, description, sort_order) VALUES
  ('dashboard', 'Dashboard', 'Main dashboard with overview', 1),
  ('transactions', 'Transactions', 'Manage buy and sell transactions', 2),
  ('ipo-transactions', 'IPO Transactions', 'Manage IPO share purchases', 3),
  ('transaction-approvals', 'Transaction Approvals', 'Approve or reject transaction requests', 4),
  ('buy-sell-notes', 'Buy & Sell Notes', 'Manage buy and sell notes', 5),
  ('buy-sell-approvals', 'Buy & Sell Approvals', 'Approve buy and sell notes', 6),
  ('cash-balance', 'Cash Balance', 'View and manage cash balance ledger', 7),
  ('scrip-entry', 'Scrip Entry', 'Entry of scrip transactions', 8),
  ('dividends', 'Dividends', 'Manage dividend records', 9),
  ('rights-issues', 'Rights Issues', 'Manage rights issues', 10),
  ('amalgamations', 'Amalgamations', 'Manage company amalgamations', 11),
  ('share-buybacks', 'Share Buybacks', 'Manage share buyback events', 12),
  ('share-subdivisions', 'Share Subdivisions', 'Manage share subdivision events', 13),
  ('daily-prices', 'Daily Prices', 'View and update daily share prices', 14),
  ('share-analytics', 'Share Analytics', 'View share analytics and insights', 15),
  ('portfolio', 'Portfolio', 'View portfolio overview', 16),
  ('entities', 'Entities', 'Manage entities/clients', 17),
  ('shares', 'Shares', 'Manage share listings', 18),
  ('banks', 'Banks', 'Manage bank accounts', 19),
  ('brokerage-fee-types', 'Brokerage Fee Types', 'Manage brokerage fee types', 20),
  ('reports', 'Reports', 'Generate and view reports', 21),
  ('settings', 'Settings', 'Application settings', 22),
  ('user-management', 'User Management', 'Manage users and permissions (Super Admin only)', 23)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entity_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_menu_access ENABLE ROW LEVEL SECURITY;

-- Policies for app_users
CREATE POLICY "Users can view their own profile"
  ON app_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins can view all users"
  ON app_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert users"
  ON app_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update users"
  ON app_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete users"
  ON app_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policies for user_entity_access
CREATE POLICY "Users can view their own entity access"
  ON user_entity_access FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all entity access"
  ON user_entity_access FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policies for menu_items
CREATE POLICY "Anyone can view active menu items"
  ON menu_items FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins can manage menu items"
  ON menu_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policies for user_menu_access
CREATE POLICY "Users can view their own menu access"
  ON user_menu_access FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all menu access"
  ON user_menu_access FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Create function to automatically create app_users entry when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.app_users (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'manager')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for app_users updated_at
DROP TRIGGER IF EXISTS update_app_users_updated_at ON app_users;
CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
