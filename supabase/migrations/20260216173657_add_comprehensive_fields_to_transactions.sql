/*
  # Add Comprehensive Fields to Transactions

  1. Changes to `transactions` table
    - Add `broker_id` (uuid, foreign key to brokers table) - Broker handling the transaction
    - Add `bank_id` (uuid, foreign key to banks table) - Bank account used for settlement
    - Add `order_type` (text) - Order type (MARKET, LIMIT, etc.)
    - Add `cds_account_id` (text) - CDS Account ID / Broker Account ID
    - Add `brokerage_fee_type_id` (uuid, foreign key to brokerage_fee_types) - Fee type used
    - Add `brokerage_fee_rate` (numeric) - Snapshot of fee rate at transaction time
    - Add `total_amount_gross` (numeric) - Gross transaction amount before fees
    - Add `net_price_per_share` (numeric) - Net price per share after fees
  
  2. Notes
    - These fields enable comprehensive transaction tracking
    - Broker and bank relationships allow for better accounting
    - Order type tracks how the transaction was executed
    - Fee rate snapshot preserves historical accuracy
    - Gross and net amounts provide complete financial picture
*/

DO $$
BEGIN
  -- Add broker_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN broker_id uuid REFERENCES brokers(id) ON DELETE SET NULL;
  END IF;

  -- Add bank_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'bank_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN bank_id uuid REFERENCES banks(id) ON DELETE SET NULL;
  END IF;

  -- Add order_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'order_type'
  ) THEN
    ALTER TABLE transactions ADD COLUMN order_type text DEFAULT 'MARKET';
  END IF;

  -- Add cds_account_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'cds_account_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN cds_account_id text;
  END IF;

  -- Add brokerage_fee_type_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'brokerage_fee_type_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN brokerage_fee_type_id uuid REFERENCES brokerage_fee_types(id) ON DELETE SET NULL;
  END IF;

  -- Add brokerage_fee_rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'brokerage_fee_rate'
  ) THEN
    ALTER TABLE transactions ADD COLUMN brokerage_fee_rate numeric(15,2);
  END IF;

  -- Add total_amount_gross
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'total_amount_gross'
  ) THEN
    ALTER TABLE transactions ADD COLUMN total_amount_gross numeric(15,2);
  END IF;

  -- Add net_price_per_share
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'net_price_per_share'
  ) THEN
    ALTER TABLE transactions ADD COLUMN net_price_per_share numeric(15,2);
  END IF;
END $$;
