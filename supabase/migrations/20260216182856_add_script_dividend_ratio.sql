/*
  # Add Script Dividend Ratio to Dividends Table

  1. Changes
    - Add `script_dividend_ratio` column: For script dividends (dividend paid in shares)
      Format: "X:Y" where X shares are given for every Y shares held
      Example: "1:10" means 1 new share for every 10 shares held

  2. Notes
    - Announcement date and effective date already exist in the table
    - No transaction_type field exists to remove
*/

-- Add script_dividend_ratio column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'script_dividend_ratio'
  ) THEN
    ALTER TABLE dividends ADD COLUMN script_dividend_ratio TEXT;
    
    COMMENT ON COLUMN dividends.script_dividend_ratio IS 'Script dividend ratio (e.g., 1:10 means 1 new share per 10 shares held)';
  END IF;
END $$;
