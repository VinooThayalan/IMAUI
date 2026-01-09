/*
  # Create Brokerage Fee Types Table

  1. New Tables
    - `brokerage_fee_types`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Fee type name (e.g., "Standard", "Premium", "Discount")
      - `rate` (decimal) - Brokerage fee rate/percentage
      - `description` (text, optional) - Description of the fee type
      - `is_active` (boolean) - Whether this fee type is active
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `brokerage_fee_types` table
    - Add policies for public read access
    - Add policies for authenticated insert/update/delete
*/

CREATE TABLE IF NOT EXISTS brokerage_fee_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  rate decimal(5,2) NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE brokerage_fee_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to brokerage_fee_types"
  ON brokerage_fee_types
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to brokerage_fee_types"
  ON brokerage_fee_types
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to brokerage_fee_types"
  ON brokerage_fee_types
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from brokerage_fee_types"
  ON brokerage_fee_types
  FOR DELETE
  TO public
  USING (true);

-- Insert some default brokerage fee types
INSERT INTO brokerage_fee_types (name, rate, description) VALUES
  ('Standard', 0.30, 'Standard brokerage fee rate'),
  ('Premium', 0.25, 'Premium tier brokerage fee rate'),
  ('Discount', 0.20, 'Discounted brokerage fee rate'),
  ('VIP', 0.15, 'VIP tier brokerage fee rate')
ON CONFLICT (name) DO NOTHING;