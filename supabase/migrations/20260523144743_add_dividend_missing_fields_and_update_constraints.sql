/*
  # Add Missing Fields to Dividends Table and Update Constraints

  ## Summary
  Adds the fields required by the updated Dividends form:
  - `dividend_date` — general dividend/record date (the "Date" field)
  - `bank_name` — bank where dividend will be received
  - `bank_account_no` — bank account number for receipt
  - `withholding_tax_rate` — withholding tax percentage (e.g. 10 for 10%), used to auto-calculate net

  ## Constraint Updates
  - Status: old values (Pending, Processing, Paid, Cancelled) migrated to new values
    (Awaiting dividend, Received, Finalized).  Old constraint dropped and recreated.
  - Payment Method: constraint relaxed to include 'Transfer (CEFT)' alongside legacy values.

  ## Notes
  - No data is deleted; existing rows are migrated to the nearest equivalent new status.
  - All new columns are nullable to avoid breaking existing rows.
*/

-- 1. Add dividend_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'dividend_date'
  ) THEN
    ALTER TABLE dividends ADD COLUMN dividend_date date;
  END IF;
END $$;

-- 2. Add bank_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE dividends ADD COLUMN bank_name text;
  END IF;
END $$;

-- 3. Add bank_account_no column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'bank_account_no'
  ) THEN
    ALTER TABLE dividends ADD COLUMN bank_account_no text;
  END IF;
END $$;

-- 4. Add withholding_tax_rate column (percentage, e.g. 10 = 10%)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'withholding_tax_rate'
  ) THEN
    ALTER TABLE dividends ADD COLUMN withholding_tax_rate numeric DEFAULT 0;
  END IF;
END $$;

-- 5. Migrate existing status values to new set before updating constraint
UPDATE dividends SET status = 'Awaiting dividend' WHERE status IN ('Pending', 'Cancelled');
UPDATE dividends SET status = 'Received'          WHERE status = 'Processing';
UPDATE dividends SET status = 'Finalized'          WHERE status = 'Paid';

-- 6. Drop old status constraint and recreate with new values
ALTER TABLE dividends DROP CONSTRAINT IF EXISTS dividends_status_check;
ALTER TABLE dividends ADD CONSTRAINT dividends_status_check
  CHECK (status IN ('Awaiting dividend', 'Received', 'Finalized'));

-- 7. Drop old payment_method constraint and recreate (expands allowed values)
ALTER TABLE dividends DROP CONSTRAINT IF EXISTS dividends_payment_method_check;
ALTER TABLE dividends ADD CONSTRAINT dividends_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN (
    'Cheque', 'Transfer (CEFT)', 'Transfer-CEFT', 'Direct Deposit', 'Other'
  ));
