/*
  # Add Per-Component Fee Breakdown Columns to Transactions

  ## Summary
  Currently the transactions table stores only a single `fees` column representing the
  total of all fee components combined. This migration adds six new columns to store each
  fee component's amount individually at the time the transaction is created, preserving
  the full breakdown for historical accuracy and reporting.

  ## New Columns on `transactions` table
  1. `brokerage_fee` (numeric(15,2)) — Brokerage Fee component amount
  2. `cse_fee` (numeric(15,2)) — CSE (Colombo Stock Exchange) Fees component amount
  3. `cds_fee` (numeric(15,2)) — CDS (Central Depository System) Fees component amount
  4. `clearing_fee` (numeric(15,2)) — Clearing Fees component amount
  5. `sec_cess` (numeric(15,2)) — SEC CESS (Securities and Exchange Commission) component amount
  6. `share_transaction_levy` (numeric(15,2)) — Share Transaction Levy (Gov Levy / IOVY) component amount

  ## Notes
  - All columns are nullable so existing transactions remain unaffected.
  - New transactions will populate all six columns at creation time.
  - The existing `fees` column (total) is retained for backward compatibility.
  - The sum of the six new columns equals the existing `fees` total for new transactions.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'brokerage_fee'
  ) THEN
    ALTER TABLE transactions ADD COLUMN brokerage_fee numeric(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'cse_fee'
  ) THEN
    ALTER TABLE transactions ADD COLUMN cse_fee numeric(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'cds_fee'
  ) THEN
    ALTER TABLE transactions ADD COLUMN cds_fee numeric(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'clearing_fee'
  ) THEN
    ALTER TABLE transactions ADD COLUMN clearing_fee numeric(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'sec_cess'
  ) THEN
    ALTER TABLE transactions ADD COLUMN sec_cess numeric(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'share_transaction_levy'
  ) THEN
    ALTER TABLE transactions ADD COLUMN share_transaction_levy numeric(15,2);
  END IF;
END $$;