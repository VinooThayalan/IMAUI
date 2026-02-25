/*
  # Add Extracted PDF Fields to Buy/Sell Notes

  1. Changes
    - Add new columns to buy_sell_notes table to store extracted PDF data
    - trade_date: Trade date from the contract note
    - contract_no: Contract number from the broker
    - no_of_shares: Number of shares from PDF
    - price_avg: Average price from PDF
    - gross_amount: Gross amount from PDF
    - brokerage: Brokerage fee from PDF
    - sec: SEC fee from PDF
    - exchange: Exchange fee from PDF
    - cds: CDS fee from PDF
    - gov_cess: Government cess from PDF
    - clearing_fees: Clearing fees from PDF
    - net_amount: Net settlement amount from PDF
    - foreign_brokerage: Foreign brokerage fee from PDF

  2. Notes
    - All new fields are optional (nullable)
    - Decimal fields use numeric type for precision
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'trade_date'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN trade_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'contract_no'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN contract_no text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'no_of_shares'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN no_of_shares numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'price_avg'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN price_avg numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'gross_amount'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN gross_amount numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'brokerage'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN brokerage numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'sec'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN sec numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'exchange'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN exchange numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'cds'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN cds numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'gov_cess'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN gov_cess numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'clearing_fees'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN clearing_fees numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN net_amount numeric(20, 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'foreign_brokerage'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN foreign_brokerage numeric(20, 4);
  END IF;
END $$;
