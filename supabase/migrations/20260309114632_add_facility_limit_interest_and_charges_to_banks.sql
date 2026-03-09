/*
  # Add Facility Limit, Interest Rate, and Charges to Banks

  1. Changes
    - Add `facility_limit` column to banks table (numeric, default 0)
    - Add `interest_rate` column to banks table (numeric, default 0)
    - Add `charges_per_transaction` column to banks table (numeric, default 0)

  2. Notes
    - All fields are numeric to store monetary values and percentages
    - Default values set to 0 to ensure data consistency
    - Fields allow null values for optional data entry
*/

DO $$
BEGIN
  -- Add facility_limit if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'banks' AND column_name = 'facility_limit'
  ) THEN
    ALTER TABLE banks ADD COLUMN facility_limit numeric DEFAULT 0;
  END IF;

  -- Add interest_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'banks' AND column_name = 'interest_rate'
  ) THEN
    ALTER TABLE banks ADD COLUMN interest_rate numeric DEFAULT 0;
  END IF;

  -- Add charges_per_transaction if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'banks' AND column_name = 'charges_per_transaction'
  ) THEN
    ALTER TABLE banks ADD COLUMN charges_per_transaction numeric DEFAULT 0;
  END IF;
END $$;