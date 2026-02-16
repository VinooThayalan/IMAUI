/*
  # Add Price Range to Brokerage Fee Types

  1. Changes
    - Add `min_price` column to brokerage_fee_types table
      - Stores minimum transaction value for this fee type
      - Optional field (can be NULL)
    - Add `max_price` column to brokerage_fee_types table
      - Stores maximum transaction value for this fee type
      - Optional field (can be NULL)
  
  2. Notes
    - Price range allows for tiered fee structures based on transaction size
    - NULL values indicate no limit for that boundary
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokerage_fee_types' AND column_name = 'min_price'
  ) THEN
    ALTER TABLE brokerage_fee_types ADD COLUMN min_price NUMERIC(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokerage_fee_types' AND column_name = 'max_price'
  ) THEN
    ALTER TABLE brokerage_fee_types ADD COLUMN max_price NUMERIC(15,2);
  END IF;
END $$;
