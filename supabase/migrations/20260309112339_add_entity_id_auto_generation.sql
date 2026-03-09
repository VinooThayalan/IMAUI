/*
  # Add Entity ID Auto-Generation

  1. Changes
    - Create sequence for entity numbering
    - Create trigger function to auto-generate entity_id in format ENT001, ENT002, etc.
    - Apply trigger to entities table
    
  2. Purpose
    - Automatically generate entity_id when new entities are created
    - Use format ENT001, ENT002, ENT003, etc.
    - Ensure unique sequential numbering
*/

-- Create sequence for entity numbering
CREATE SEQUENCE IF NOT EXISTS entities_sequence START WITH 1;

-- Create function to generate entity_id
CREATE OR REPLACE FUNCTION generate_entity_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_id IS NULL OR NEW.entity_id = '' THEN
    NEW.entity_id := 'ENT' || LPAD(nextval('entities_sequence')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_entity_id ON entities;

-- Create trigger to auto-generate entity_id on insert
CREATE TRIGGER set_entity_id
  BEFORE INSERT ON entities
  FOR EACH ROW
  EXECUTE FUNCTION generate_entity_id();

-- Update existing entities that don't have entity_id
DO $$
DECLARE
  entity_record RECORD;
  new_id TEXT;
BEGIN
  FOR entity_record IN 
    SELECT id FROM entities 
    WHERE entity_id IS NULL OR entity_id = ''
    ORDER BY created_at
  LOOP
    new_id := 'ENT' || LPAD(nextval('entities_sequence')::TEXT, 3, '0');
    UPDATE entities SET entity_id = new_id WHERE id = entity_record.id;
  END LOOP;
END $$;