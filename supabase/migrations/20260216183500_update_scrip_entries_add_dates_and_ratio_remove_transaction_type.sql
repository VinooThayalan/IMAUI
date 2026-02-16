/*
  # Update Scrip Entries Table

  1. Changes to scrip_entries table
    - Add `announcement_date` column (date): When the scrip dividend was announced
    - Add `effective_date` column (date): When the scrip dividend becomes effective
    - Add `script_dividend_ratio` column (text): Ratio for script dividends (e.g., "1:10")
    - Remove `transaction_type` column: No longer needed for scrip entries

  2. Notes
    - Existing scrip entries will have NULL values for new date fields
    - The transaction_type field is being removed as requested
*/

-- Add new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scrip_entries' AND column_name = 'announcement_date'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN announcement_date DATE;
    COMMENT ON COLUMN scrip_entries.announcement_date IS 'Date when the scrip dividend was announced';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scrip_entries' AND column_name = 'effective_date'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN effective_date DATE;
    COMMENT ON COLUMN scrip_entries.effective_date IS 'Date when the scrip dividend becomes effective';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scrip_entries' AND column_name = 'script_dividend_ratio'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN script_dividend_ratio TEXT;
    COMMENT ON COLUMN scrip_entries.script_dividend_ratio IS 'Script dividend ratio (e.g., 1:10 means 1 new share per 10 shares held)';
  END IF;
END $$;

-- Remove transaction_type column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scrip_entries' AND column_name = 'transaction_type'
  ) THEN
    ALTER TABLE scrip_entries DROP COLUMN transaction_type;
  END IF;
END $$;
