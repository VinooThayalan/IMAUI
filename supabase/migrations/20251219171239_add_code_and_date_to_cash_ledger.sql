/*
  # Add Code and Date Fields to Cash Balance Ledger

  1. Changes
    - Add `code` column to `cash_balance_ledger` table for transaction codes (e.g., '001', '002', '900')
    - Add `date` column to `cash_balance_ledger` table for the transaction date (separate from timestamp)
    - Add index on `entity_id` and `date` for efficient cash book queries

  2. Purpose
    - Support traditional cash book format with transaction codes
    - Enable chronological organization by transaction date
    - Improve query performance for entity-specific cash book views
*/

-- Add code column for transaction codes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_balance_ledger' AND column_name = 'code'
  ) THEN
    ALTER TABLE cash_balance_ledger ADD COLUMN code text;
  END IF;
END $$;

-- Add date column for transaction date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_balance_ledger' AND column_name = 'date'
  ) THEN
    ALTER TABLE cash_balance_ledger ADD COLUMN date date DEFAULT CURRENT_DATE NOT NULL;
  END IF;
END $$;

-- Create composite index for entity-specific date-ordered queries
CREATE INDEX IF NOT EXISTS idx_ledger_entity_date 
  ON cash_balance_ledger(entity_id, date DESC) 
  WHERE entity_id IS NOT NULL;