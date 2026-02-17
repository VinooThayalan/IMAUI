/*
  # Add On Hold Amount to Cash Balance Ledger

  1. Changes
    - Add `on_hold_amount` column to `cash_balance_ledger` table
    - This tracks the amount that is held/reserved and not available for use
    - Used to calculate the available balance (running_balance - on_hold_amount)

  2. Purpose
    - Support tracking of held/reserved funds that are committed but not yet processed
    - Enable calculation of available balance vs current balance
    - Helps with liquidity management and overdraft calculations
*/

-- Add on_hold_amount column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_balance_ledger' AND column_name = 'on_hold_amount'
  ) THEN
    ALTER TABLE cash_balance_ledger ADD COLUMN on_hold_amount numeric(15,2) DEFAULT 0 NOT NULL;
  END IF;
END $$;