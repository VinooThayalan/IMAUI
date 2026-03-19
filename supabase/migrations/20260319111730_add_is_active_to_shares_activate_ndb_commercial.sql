/*
  # Add is_active to shares and activate NDB & Commercial Bank

  1. Changes
    - `shares` table: Add `is_active` boolean column (default false)
    - Activate the NDB (National Development Bank PLC) share
    - Activate the Commercial Bank of Ceylon PLC shares (COMB and COMB.N0000)

  2. Notes
    - All existing shares default to inactive; only explicitly activated shares show as active
    - NDB ticker and both Commercial Bank variants (COMB, COMB.N0000) are set active
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE shares ADD COLUMN is_active boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE shares
SET is_active = true
WHERE ticker IN ('NDB', 'COMB', 'COMB.N0000')
   OR share_name ILIKE '%National Development Bank%'
   OR share_name ILIKE '%Commercial Bank of Ceylon%';
