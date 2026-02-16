/*
  # Create Brokers Table

  1. New Tables
    - `brokers`
      - `id` (uuid, primary key) - Internal unique identifier
      - `broker_id` (text, unique) - Auto-generated broker ID (e.g., BRK001, BRK002)
      - `broker_name` (text, required) - Name of the broker
      - `is_active` (boolean) - Whether the broker is active
      - `created_at` (timestamp) - Record creation timestamp
      - `updated_at` (timestamp) - Record update timestamp

  2. Functions
    - Create function to auto-generate broker_id in format BRK001, BRK002, etc.

  3. Security
    - Enable RLS on `brokers` table
    - Add policies for authenticated users to read brokers
    - Add policies for authenticated users to manage brokers
*/

-- Create brokers table
CREATE TABLE IF NOT EXISTS brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id text UNIQUE,
  broker_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sequence for broker_id
CREATE SEQUENCE IF NOT EXISTS broker_id_seq START WITH 1;

-- Create function to generate broker_id
CREATE OR REPLACE FUNCTION generate_broker_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_broker_id text;
BEGIN
  next_id := nextval('broker_id_seq');
  new_broker_id := 'BRK' || lpad(next_id::text, 3, '0');
  RETURN new_broker_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate broker_id before insert
CREATE OR REPLACE FUNCTION set_broker_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.broker_id IS NULL THEN
    NEW.broker_id := generate_broker_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_broker_id
  BEFORE INSERT ON brokers
  FOR EACH ROW
  EXECUTE FUNCTION set_broker_id();

-- Enable RLS on brokers
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

-- Create policies for brokers
CREATE POLICY "Authenticated users can read brokers"
  ON brokers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert brokers"
  ON brokers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update brokers"
  ON brokers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete brokers"
  ON brokers FOR DELETE
  TO authenticated
  USING (true);