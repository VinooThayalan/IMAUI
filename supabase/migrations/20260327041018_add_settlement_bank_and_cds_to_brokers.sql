/*
  # Add Settlement Bank Account and Broker CDS Account to Brokers

  ## Summary
  Adds two new optional fields to the brokers table:
  - `settlement_bank_account`: The broker's settlement bank account number
  - `broker_cds_account`: The broker's CDS (Central Depository System) account number

  ## Changes
  - Modified table: `brokers`
    - New column: `settlement_bank_account` (text, nullable) - broker's settlement bank account
    - New column: `broker_cds_account` (text, nullable) - broker's CDS account number
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'settlement_bank_account'
  ) THEN
    ALTER TABLE brokers ADD COLUMN settlement_bank_account text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'broker_cds_account'
  ) THEN
    ALTER TABLE brokers ADD COLUMN broker_cds_account text;
  END IF;
END $$;
