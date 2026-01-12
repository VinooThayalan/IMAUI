/*
  # Add IPO Transaction Type

  1. Changes
    - Add 'IPO' as a valid transaction type to the transactions table
    - This allows tracking Initial Public Offering share purchases separately from regular buy/sell transactions

  2. Notes
    - Drops and recreates the constraint to include the new IPO type
    - Existing data is preserved
*/

DO $$
BEGIN
  -- Drop the existing constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'transactions_transaction_type_check'
    AND table_name = 'transactions'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT transactions_transaction_type_check;
  END IF;

  -- Add the new constraint with IPO included
  ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
    CHECK (transaction_type IN ('BUY', 'SELL', 'IPO'));
END $$;
