/*
  # Create Industry Types and Sector Types Tables

  1. New Tables
    - `industry_types`
      - `id` (uuid, primary key) - Internal unique identifier
      - `industry_id` (text, unique) - Auto-generated industry ID (e.g., IND001, IND002)
      - `industry_name` (text, required) - Name of the industry
      - `is_active` (boolean) - Whether the industry is active
      - `created_at` (timestamp) - Record creation timestamp
      - `updated_at` (timestamp) - Record update timestamp

    - `sector_types`
      - `id` (uuid, primary key) - Internal unique identifier
      - `sector_id` (text, unique) - Auto-generated sector ID (e.g., SEC001, SEC002)
      - `sector_name` (text, required) - Name of the sector
      - `industry_id` (uuid, foreign key) - Reference to industry_types
      - `is_active` (boolean) - Whether the sector is active
      - `created_at` (timestamp) - Record creation timestamp
      - `updated_at` (timestamp) - Record update timestamp

  2. Functions
    - Create functions to auto-generate industry_id and sector_id

  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read and manage data
*/

-- Create industry_types table
CREATE TABLE IF NOT EXISTS industry_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id text UNIQUE,
  industry_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sector_types table
CREATE TABLE IF NOT EXISTS sector_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id text UNIQUE,
  sector_name text NOT NULL,
  industry_id uuid REFERENCES industry_types(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sequences for IDs
CREATE SEQUENCE IF NOT EXISTS industry_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS sector_id_seq START WITH 1;

-- Create function to generate industry_id
CREATE OR REPLACE FUNCTION generate_industry_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_industry_id text;
BEGIN
  next_id := nextval('industry_id_seq');
  new_industry_id := 'IND' || lpad(next_id::text, 3, '0');
  RETURN new_industry_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate sector_id
CREATE OR REPLACE FUNCTION generate_sector_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_sector_id text;
BEGIN
  next_id := nextval('sector_id_seq');
  new_sector_id := 'SEC' || lpad(next_id::text, 3, '0');
  RETURN new_sector_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate industry_id before insert
CREATE OR REPLACE FUNCTION set_industry_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.industry_id IS NULL THEN
    NEW.industry_id := generate_industry_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_industry_id
  BEFORE INSERT ON industry_types
  FOR EACH ROW
  EXECUTE FUNCTION set_industry_id();

-- Create trigger to auto-generate sector_id before insert
CREATE OR REPLACE FUNCTION set_sector_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sector_id IS NULL THEN
    NEW.sector_id := generate_sector_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_sector_id
  BEFORE INSERT ON sector_types
  FOR EACH ROW
  EXECUTE FUNCTION set_sector_id();

-- Enable RLS on industry_types
ALTER TABLE industry_types ENABLE ROW LEVEL SECURITY;

-- Create policies for industry_types
CREATE POLICY "Authenticated users can read industry_types"
  ON industry_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert industry_types"
  ON industry_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update industry_types"
  ON industry_types FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete industry_types"
  ON industry_types FOR DELETE
  TO authenticated
  USING (true);

-- Enable RLS on sector_types
ALTER TABLE sector_types ENABLE ROW LEVEL SECURITY;

-- Create policies for sector_types
CREATE POLICY "Authenticated users can read sector_types"
  ON sector_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sector_types"
  ON sector_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sector_types"
  ON sector_types FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sector_types"
  ON sector_types FOR DELETE
  TO authenticated
  USING (true);