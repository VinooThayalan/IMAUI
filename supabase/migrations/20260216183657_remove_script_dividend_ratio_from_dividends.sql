/*
  # Remove Script Dividend Ratio from Dividends Table

  1. Changes
    - Remove `script_dividend_ratio` column from dividends table
    - This field has been moved to scrip_entries table instead

  2. Notes
    - Script dividend ratio is now tracked in the scrip_entries table
    - Existing data with script_dividend_ratio will be lost (if any)
*/

-- Remove script_dividend_ratio column from dividends
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'script_dividend_ratio'
  ) THEN
    ALTER TABLE dividends DROP COLUMN script_dividend_ratio;
  END IF;
END $$;
