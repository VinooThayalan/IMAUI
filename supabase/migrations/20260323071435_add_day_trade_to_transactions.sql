/*
  # Add day_trade flag to transactions

  1. Changes
    - Add `day_trade` boolean column to `transactions` table
      - Marks a transaction as a day trade (buy and sell on same day)
      - When true, all fees except levy are zeroed out
      - Defaults to false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'day_trade'
  ) THEN
    ALTER TABLE transactions ADD COLUMN day_trade boolean DEFAULT false;
  END IF;
END $$;
