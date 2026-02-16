/*
  # Create Entity Types Configuration Table and Update Entities

  1. New Tables
    - `entity_types`
      - `id` (uuid, primary key)
      - `name` (text) - Entity type name (e.g., Individual, Corporate)
      - `description` (text, optional) - Description of the entity type
      - `is_active` (boolean) - Whether the entity type is active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to Existing Tables
    - `entities`
      - Rename `tax_id` to `tax_name`
      - Rename `nic` to `nic_pv_number`
      - Rename `manager` to `key_contact_name`
      - Rename `address` to `company_individual_address`
      - Rename `contact_email` to `contact_email_company_individual`
      - Rename `contact_mobile_number` to `contact_mobile_number_1`
      - Add `contact_mobile_number_2` (text, optional)
      - Add `entity_type_id` (uuid, foreign key to entity_types)
      - Remove `od_limit` column (if exists)

  3. Security
    - Enable RLS on `entity_types` table
    - Add policies for authenticated users to read entity types
    - Add policies for authenticated users to manage entity types
*/

-- Create entity_types table
CREATE TABLE IF NOT EXISTS entity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default entity types
INSERT INTO entity_types (name, description) VALUES
  ('Individual', 'Individual person or investor'),
  ('Corporate', 'Corporate entity or company')
ON CONFLICT (name) DO NOTHING;

-- Update entities table - Rename columns
DO $$
BEGIN
  -- Rename tax_id to tax_name
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE entities RENAME COLUMN tax_id TO tax_name;
  END IF;

  -- Rename nic to nic_pv_number
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'nic'
  ) THEN
    ALTER TABLE entities RENAME COLUMN nic TO nic_pv_number;
  END IF;

  -- Rename manager to key_contact_name
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'manager'
  ) THEN
    ALTER TABLE entities RENAME COLUMN manager TO key_contact_name;
  END IF;

  -- Rename address to company_individual_address
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'address'
  ) THEN
    ALTER TABLE entities RENAME COLUMN address TO company_individual_address;
  END IF;

  -- Rename contact_email to contact_email_company_individual
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE entities RENAME COLUMN contact_email TO contact_email_company_individual;
  END IF;

  -- Rename contact_mobile_number to contact_mobile_number_1
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'contact_mobile_number'
  ) THEN
    ALTER TABLE entities RENAME COLUMN contact_mobile_number TO contact_mobile_number_1;
  END IF;
END $$;

-- Add new columns to entities table
DO $$
BEGIN
  -- Add contact_mobile_number_2 if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'contact_mobile_number_2'
  ) THEN
    ALTER TABLE entities ADD COLUMN contact_mobile_number_2 text;
  END IF;

  -- Add entity_type_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'entity_type_id'
  ) THEN
    ALTER TABLE entities ADD COLUMN entity_type_id uuid REFERENCES entity_types(id);
  END IF;
END $$;

-- Remove od_limit column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'od_limit'
  ) THEN
    ALTER TABLE entities DROP COLUMN od_limit;
  END IF;
END $$;

-- Enable RLS on entity_types
ALTER TABLE entity_types ENABLE ROW LEVEL SECURITY;

-- Create policies for entity_types
CREATE POLICY "Authenticated users can read entity types"
  ON entity_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert entity types"
  ON entity_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update entity types"
  ON entity_types FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete entity types"
  ON entity_types FOR DELETE
  TO authenticated
  USING (true);