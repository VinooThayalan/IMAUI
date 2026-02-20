/*
  # Create Currency Table

  1. New Tables
    - `currencies`
      - `id` (uuid, primary key)
      - `currency_id` (text, unique) - Currency code/identifier
      - `currency_symbol` (text) - Symbol representation (e.g., Rs., $, €)
      - `currency_name` (text) - Full currency name
      - `is_active` (boolean) - Whether currency is active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `currencies` table
    - Add policy for authenticated users to read currencies

  3. Initial Data
    - Insert common currencies including LKR (Sri Lankan Rupee)
*/

CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_id text UNIQUE NOT NULL,
  currency_symbol text NOT NULL,
  currency_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read currencies"
  ON currencies
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert currencies"
  ON currencies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update currencies"
  ON currencies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert initial currencies
INSERT INTO currencies (currency_id, currency_symbol, currency_name, is_active) VALUES
  ('LKR', 'Rs.', 'Sri Lankan Rupee', true),
  ('USD', '$', 'United States Dollar', true),
  ('EUR', '€', 'Euro', true),
  ('GBP', '£', 'British Pound Sterling', true),
  ('INR', '₹', 'Indian Rupee', true),
  ('AUD', 'A$', 'Australian Dollar', true),
  ('SGD', 'S$', 'Singapore Dollar', true),
  ('JPY', '¥', 'Japanese Yen', true)
ON CONFLICT (currency_id) DO NOTHING;