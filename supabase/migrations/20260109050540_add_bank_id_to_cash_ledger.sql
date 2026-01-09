/*
  # Add Bank ID to Cash Balance Ledger

  1. Changes
    - Add `bank_id` column to `cash_balance_ledger` table to track which bank account is associated with each transaction
    - Add foreign key constraint to reference the banks table

  2. Notes
    - Column is nullable to support existing records and transactions that may not have an associated bank
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_balance_ledger' AND column_name = 'bank_id'
  ) THEN
    ALTER TABLE cash_balance_ledger 
    ADD COLUMN bank_id uuid REFERENCES banks(id);
  END IF;
END $$;
