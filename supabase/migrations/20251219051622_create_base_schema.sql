/*
  # Create Base Schema for Portfolio Management System

  1. New Tables
    - `entities`
      - `id` (uuid, primary key)
      - `entity_id` (text, unique) - Auto-generated ID (E001, E002, etc.)
      - `name` (text) - Entity name
      - `type` (text) - Entity type
      - `od_limit` (numeric) - Overdraft limit
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `shares`
      - `id` (uuid, primary key)
      - `symbol` (text, unique) - Stock symbol
      - `name` (text) - Company name
      - `sector` (text) - Industry sector
      - `currency` (text) - Currency (default LKR)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `banks`
      - `id` (uuid, primary key)
      - `entity_id` (uuid, foreign key) - Optional link to entity
      - `name` (text) - Bank name
      - `account_number` (text) - Account number
      - `branch` (text) - Branch name
      - `currency` (text) - Currency (default LKR)
      - `balance` (numeric) - Current balance
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `dividends`
      - `id` (uuid, primary key)
      - `entity_id` (uuid, foreign key)
      - `share_id` (uuid, foreign key)
      - `payment_date` (date)
      - `amount_gross` (numeric)
      - `amount_net` (numeric)
      - `tax_withheld` (numeric)
      - `currency` (text) - Currency (default LKR)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `transactions`
      - `id` (uuid, primary key)
      - `entity_id` (uuid, foreign key)
      - `share_id` (uuid, foreign key)
      - `transaction_type` (text) - BUY/SELL
      - `transaction_date` (date)
      - `no_of_shares` (numeric)
      - `price_per_share` (numeric)
      - `total_amount` (numeric)
      - `fees` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create entities table
CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text UNIQUE,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'Individual',
  od_limit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create shares table
CREATE TABLE IF NOT EXISTS shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  sector text DEFAULT '',
  currency text DEFAULT 'LKR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create banks table
CREATE TABLE IF NOT EXISTS banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  account_number text DEFAULT '',
  branch text DEFAULT '',
  currency text DEFAULT 'LKR',
  balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create dividends table
CREATE TABLE IF NOT EXISTS dividends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  share_id uuid REFERENCES shares(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_gross numeric DEFAULT 0,
  amount_net numeric DEFAULT 0,
  tax_withheld numeric DEFAULT 0,
  currency text DEFAULT 'LKR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  share_id uuid REFERENCES shares(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  no_of_shares numeric NOT NULL DEFAULT 0,
  price_per_share numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  fees numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies for entities
CREATE POLICY "Allow all operations on entities"
  ON entities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for shares
CREATE POLICY "Allow all operations on shares"
  ON shares FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for banks
CREATE POLICY "Allow all operations on banks"
  ON banks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for dividends
CREATE POLICY "Allow all operations on dividends"
  ON dividends FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for transactions
CREATE POLICY "Allow all operations on transactions"
  ON transactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to generate entity_id automatically
CREATE OR REPLACE FUNCTION generate_entity_id()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  new_id TEXT;
BEGIN
  IF NEW.entity_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(entity_id FROM 2) AS INTEGER)), 0) + 1
    INTO next_num
    FROM entities
    WHERE entity_id ~ '^E[0-9]+$';
    
    new_id := 'E' || LPAD(next_num::TEXT, 3, '0');
    NEW.entity_id := new_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate entity_id
DROP TRIGGER IF EXISTS set_entity_id ON entities;
CREATE TRIGGER set_entity_id
  BEFORE INSERT ON entities
  FOR EACH ROW
  EXECUTE FUNCTION generate_entity_id();