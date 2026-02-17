/*
  # Create Fee Structure Tables

  1. New Tables
    - `fee_components`
      - `id` (uuid, primary key)
      - `component_name` (text) - e.g., "Brokerage fee", "CSE Fees", etc.
      - `component_code` (text) - Short code for the component
      - `display_order` (integer) - Order to display fees
      - `is_active` (boolean)
      - `created_at` (timestamp)
    
    - `fee_tiers`
      - `id` (uuid, primary key)
      - `tier_name` (text) - e.g., "Below 100M", "Above 100M"
      - `min_transaction_value` (decimal) - Minimum transaction value for this tier
      - `max_transaction_value` (decimal) - Maximum transaction value (null for unlimited)
      - `is_active` (boolean)
      - `created_at` (timestamp)
    
    - `fee_rates`
      - `id` (uuid, primary key)
      - `fee_component_id` (uuid) - References fee_components
      - `fee_tier_id` (uuid) - References fee_tiers
      - `rate_percentage` (decimal) - The fee rate as a percentage
      - `is_active` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read data
    - Add policies for authenticated users to manage data

  3. Initial Data
    - Pre-populate with the standard Sri Lankan brokerage fee structure
*/

-- Create fee_components table
CREATE TABLE IF NOT EXISTS fee_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL,
  component_code text UNIQUE NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create fee_tiers table
CREATE TABLE IF NOT EXISTS fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  min_transaction_value decimal(20, 2) DEFAULT 0,
  max_transaction_value decimal(20, 2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create fee_rates table
CREATE TABLE IF NOT EXISTS fee_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_component_id uuid NOT NULL REFERENCES fee_components(id) ON DELETE CASCADE,
  fee_tier_id uuid NOT NULL REFERENCES fee_tiers(id) ON DELETE CASCADE,
  rate_percentage decimal(10, 6) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(fee_component_id, fee_tier_id)
);

-- Enable RLS
ALTER TABLE fee_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_rates ENABLE ROW LEVEL SECURITY;

-- Policies for fee_components
CREATE POLICY "Users can read fee components"
  ON fee_components FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert fee components"
  ON fee_components FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update fee components"
  ON fee_components FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete fee components"
  ON fee_components FOR DELETE
  TO authenticated
  USING (true);

-- Policies for fee_tiers
CREATE POLICY "Users can read fee tiers"
  ON fee_tiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert fee tiers"
  ON fee_tiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update fee tiers"
  ON fee_tiers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete fee tiers"
  ON fee_tiers FOR DELETE
  TO authenticated
  USING (true);

-- Policies for fee_rates
CREATE POLICY "Users can read fee rates"
  ON fee_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert fee rates"
  ON fee_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update fee rates"
  ON fee_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete fee rates"
  ON fee_rates FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fee_rates_component ON fee_rates(fee_component_id);
CREATE INDEX IF NOT EXISTS idx_fee_rates_tier ON fee_rates(fee_tier_id);
CREATE INDEX IF NOT EXISTS idx_fee_components_active ON fee_components(is_active);
CREATE INDEX IF NOT EXISTS idx_fee_tiers_active ON fee_tiers(is_active);

-- Insert fee components
INSERT INTO fee_components (component_name, component_code, display_order) VALUES
  ('Brokerage fee', 'BROKERAGE', 1),
  ('CSE Fees', 'CSE', 2),
  ('CDS Fees', 'CDS', 3),
  ('Clearing Fees', 'CLEARING', 4),
  ('SEC CESS', 'SEC_CESS', 5),
  ('Share Transaction IOVY', 'IOVY', 6)
ON CONFLICT (component_code) DO NOTHING;

-- Insert fee tiers (100M LKR = 100,000,000)
INSERT INTO fee_tiers (tier_name, min_transaction_value, max_transaction_value) VALUES
  ('Below 100M transactions', 0, 100000000),
  ('Above 100M transactions', 100000000, NULL)
ON CONFLICT DO NOTHING;

-- Insert fee rates for Option 01 (Below 100M)
INSERT INTO fee_rates (fee_component_id, fee_tier_id, rate_percentage)
SELECT 
  fc.id,
  ft.id,
  CASE fc.component_code
    WHEN 'BROKERAGE' THEN 0.64
    WHEN 'CSE' THEN 0.084
    WHEN 'CDS' THEN 0.012
    WHEN 'CLEARING' THEN 0.012
    WHEN 'SEC_CESS' THEN 0.072
    WHEN 'IOVY' THEN 0.300
  END
FROM fee_components fc
CROSS JOIN fee_tiers ft
WHERE ft.tier_name = 'Below 100M transactions'
ON CONFLICT (fee_component_id, fee_tier_id) DO NOTHING;

-- Insert fee rates for Option 02 (Above 100M)
INSERT INTO fee_rates (fee_component_id, fee_tier_id, rate_percentage)
SELECT 
  fc.id,
  ft.id,
  CASE fc.component_code
    WHEN 'BROKERAGE' THEN 0.200
    WHEN 'CSE' THEN 0.0525
    WHEN 'CDS' THEN 0.0075
    WHEN 'CLEARING' THEN 0.0075
    WHEN 'SEC_CESS' THEN 0.0450
    WHEN 'IOVY' THEN 0.300
  END
FROM fee_components fc
CROSS JOIN fee_tiers ft
WHERE ft.tier_name = 'Above 100M transactions'
ON CONFLICT (fee_component_id, fee_tier_id) DO NOTHING;
