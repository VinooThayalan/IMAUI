/*
  # Add Share ID to Banks Table

  1. Changes
    - Add share_id column to banks table as foreign key to shares table
    - This allows linking bank accounts to specific shares

  2. Security
    - No RLS changes needed as the banks table already has RLS enabled
*/

-- Add share_id column to banks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'banks' AND column_name = 'share_id'
  ) THEN
    ALTER TABLE banks ADD COLUMN share_id uuid;
  END IF;
END $$;

-- Add foreign key constraint to shares table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'banks_share_id_fkey'
  ) THEN
    ALTER TABLE banks ADD CONSTRAINT banks_share_id_fkey 
      FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE SET NULL;
  END IF;
END $$;