/*
  # Add Entity ID to Banks Table

  1. Changes
    - Add entity_id column: Links banks to entities (optional relationship)
    - Add foreign key constraint to entities table

  2. Security
    - No RLS changes needed as the banks table already has RLS enabled
*/

-- Add entity_id column to banks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'banks' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE banks ADD COLUMN entity_id UUID;
  END IF;
END $$;

-- Add foreign key constraint to entities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'banks_entity_id_fkey'
  ) THEN
    ALTER TABLE banks ADD CONSTRAINT banks_entity_id_fkey 
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL;
  END IF;
END $$;