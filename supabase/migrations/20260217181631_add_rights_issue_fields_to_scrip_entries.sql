/*
  # Add Rights Issue Fields to Scrip Entries

  1. Changes
    - Add transaction_type field to distinguish between different scrip entry types
    - Add rights issue specific fields:
      - broker_id (uuid, foreign key to brokers)
      - cds_account_id (text)
      - bank_id (uuid, foreign key to banks)
      - allotment_date (date)
      - rights_ratio (text)
      - rights_issue_price (decimal)
      - shares_at_announcement (numeric)
      - allotted_shares (numeric)
      - additional_requested (text)
      - total_amount (decimal)

  2. Notes
    - transaction_type helps categorize entries (e.g., "Rights Issue", "Stock Dividend", "Bonus Issue")
    - These fields enable comprehensive tracking of rights issue allocations
*/

-- Add transaction_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'transaction_type'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN transaction_type text;
  END IF;
END $$;

-- Add broker_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN broker_id uuid REFERENCES brokers(id);
  END IF;
END $$;

-- Add cds_account_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'cds_account_id'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN cds_account_id text;
  END IF;
END $$;

-- Add bank_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'bank_id'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN bank_id uuid REFERENCES banks(id);
  END IF;
END $$;

-- Add allotment_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'allotment_date'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN allotment_date date;
  END IF;
END $$;

-- Add rights_ratio column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'rights_ratio'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN rights_ratio text;
  END IF;
END $$;

-- Add rights_issue_price column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'rights_issue_price'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN rights_issue_price decimal(20, 2);
  END IF;
END $$;

-- Add shares_at_announcement column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'shares_at_announcement'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN shares_at_announcement numeric;
  END IF;
END $$;

-- Add allotted_shares column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'allotted_shares'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN allotted_shares numeric;
  END IF;
END $$;

-- Add additional_requested column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'additional_requested'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN additional_requested text;
  END IF;
END $$;

-- Add total_amount column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scrip_entries' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE scrip_entries ADD COLUMN total_amount decimal(20, 2);
  END IF;
END $$;

-- Create indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_scrip_entries_broker_id ON scrip_entries(broker_id);
CREATE INDEX IF NOT EXISTS idx_scrip_entries_bank_id ON scrip_entries(bank_id);
CREATE INDEX IF NOT EXISTS idx_scrip_entries_transaction_type ON scrip_entries(transaction_type);