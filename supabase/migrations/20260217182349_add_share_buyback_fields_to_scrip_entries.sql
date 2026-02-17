/*
  # Add Share Buyback Fields to Scrip Entries

  1. Changes
    - Add share buyback specific fields:
      - buyback_date (date)
      - buyback_ratio (text) - for the buyback ratio (e.g., "1:10")
      - shares_at_buyback (numeric) - number of shares held at buyback date
      - shares_accepted (text) - shares accepted in the buyback
      - additional_shares (text) - additional shares in buyback
      - buyback_rate (decimal) - price per share for buyback

  2. Notes
    - These fields enable comprehensive tracking of share buyback programs
    - Supports both accepted shares and additional shares
    - Buyback rate stores the price paid per share
*/

-- Add buyback_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'buyback_date'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN buyback_date date;
  END IF;
END $$;

-- Add buyback_ratio column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'buyback_ratio'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN buyback_ratio text;
  END IF;
END $$;

-- Add shares_at_buyback column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'shares_at_buyback'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN shares_at_buyback numeric;
  END IF;
END $$;

-- Add shares_accepted column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'shares_accepted'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN shares_accepted text;
  END IF;
END $$;

-- Add additional_shares column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'additional_shares'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN additional_shares text;
  END IF;
END $$;

-- Add buyback_rate column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'buyback_rate'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN buyback_rate decimal(20, 2);
  END IF;
END $$;