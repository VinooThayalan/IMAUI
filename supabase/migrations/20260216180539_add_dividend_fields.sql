/*
  # Add Additional Fields to Dividends Table

  1. Changes
    - Rename `ex_dividend_date` column to `effective_date` for clarity
    - Add `payment_method` column: Payment method (Cheque, Transfer-CEFT, etc.)
    - Add `cds_account` column: CDS Account reference
    - Add `notes` column: Additional notes about the dividend
    - Add `status` column: Status of dividend (Pending, Paid, Cancelled)

  2. Security
    - No RLS changes needed as the dividends table already has RLS enabled
*/

-- Rename ex_dividend_date to effective_date
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'ex_dividend_date'
  ) THEN
    ALTER TABLE dividends RENAME COLUMN ex_dividend_date TO effective_date;
  END IF;
END $$;

-- Add payment_method column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE dividends ADD COLUMN payment_method TEXT;
    
    -- Add check constraint for valid payment methods
    ALTER TABLE dividends ADD CONSTRAINT dividends_payment_method_check 
      CHECK (payment_method IS NULL OR payment_method IN ('Cheque', 'Transfer-CEFT', 'Direct Deposit', 'Other'));
  END IF;
END $$;

-- Add cds_account column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'cds_account'
  ) THEN
    ALTER TABLE dividends ADD COLUMN cds_account TEXT;
  END IF;
END $$;

-- Add notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'notes'
  ) THEN
    ALTER TABLE dividends ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Add status column with default value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'status'
  ) THEN
    ALTER TABLE dividends ADD COLUMN status TEXT DEFAULT 'Pending';
    
    -- Add check constraint for valid statuses
    ALTER TABLE dividends ADD CONSTRAINT dividends_status_check 
      CHECK (status IN ('Pending', 'Paid', 'Cancelled', 'Processing'));
  END IF;
END $$;
