/*
  # Rename symbol column to ticker in shares table

  1. Changes
    - Rename `symbol` column to `ticker` in the `shares` table
    - Maintain all existing constraints and indexes
    
  2. Security
    - No RLS changes needed
*/

-- Rename the column from symbol to ticker
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'symbol'
  ) THEN
    ALTER TABLE shares RENAME COLUMN symbol TO ticker;
  END IF;
END $$;