/*
  # Add Entity ID and OD Limit to Entities Table

  1. Changes
    - Add entity_id column: A unique identifier for each entity (e.g., E001, E002)
    - Add od_limit column: Overdraft limit for the entity in LKR
    - Create unique constraint on entity_id
    - Create function to auto-generate entity_id

  2. Security
    - No RLS changes needed as the entities table already has RLS enabled
*/

-- Add entity_id column with unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE entities ADD COLUMN entity_id TEXT UNIQUE;
  END IF;
END $$;

-- Add od_limit column (overdraft limit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'od_limit'
  ) THEN
    ALTER TABLE entities ADD COLUMN od_limit NUMERIC DEFAULT 0;
  END IF;
END $$;

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