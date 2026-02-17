/*
  # Add Amalgamation Fields to Scrip Entries

  1. Changes
    - Add amalgamation specific fields:
      - amalgamation_date (date) - date when amalgamation becomes effective
      - shares_at_effective_date (numeric) - number of shares held at effective date
      - amalgamation_ratio (text) - the amalgamation ratio (e.g., "1:5")
      - new_total_shares (numeric) - total shares after amalgamation
      - share_decrease (numeric) - number of shares decreased
      - new_price_per_share (decimal) - new price per share after amalgamation

  2. Notes
    - These fields enable comprehensive tracking of company amalgamations and mergers
    - Supports tracking share conversions and price adjustments
*/

-- Add amalgamation_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'amalgamation_date'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN amalgamation_date date;
  END IF;
END $$;

-- Add shares_at_effective_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'shares_at_effective_date'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN shares_at_effective_date numeric;
  END IF;
END $$;

-- Add amalgamation_ratio column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'amalgamation_ratio'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN amalgamation_ratio text;
  END IF;
END $$;

-- Add new_total_shares column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'new_total_shares'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN new_total_shares numeric;
  END IF;
END $$;

-- Add share_decrease column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'share_decrease'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN share_decrease numeric;
  END IF;
END $$;

-- Add new_price_per_share column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'new_price_per_share'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN new_price_per_share decimal(20, 2);
  END IF;
END $$;