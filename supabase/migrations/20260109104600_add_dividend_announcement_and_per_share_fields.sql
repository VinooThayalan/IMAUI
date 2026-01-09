/*
  # Add Announcement Date and Per-Share Dividend Fields

  1. Changes
    - Add `announcement_date` to dividends table for tracking dividend announcement date
    - Add `ex_dividend_date` to dividends table for tracking ex-dividend date
    - Add `gross_dividend_per_share` to dividends table for tracking gross dividend amount per share
    - Add `net_dividend_per_share` to dividends table for tracking net dividend amount per share
    - Add `quantity` to dividends table for tracking number of shares held
  
  2. Notes
    - The `announcement_date` is when the dividend is announced
    - The `ex_dividend_date` is the date after which new buyers won't receive the dividend
    - `gross_dividend_per_share` is the dividend amount before tax withholding
    - `net_dividend_per_share` is the dividend amount after tax withholding
    - `quantity` represents the number of shares held for the dividend payment
    - Existing `amount_gross` and `amount_net` represent total amounts (quantity * per share)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'announcement_date'
  ) THEN
    ALTER TABLE dividends ADD COLUMN announcement_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'ex_dividend_date'
  ) THEN
    ALTER TABLE dividends ADD COLUMN ex_dividend_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'gross_dividend_per_share'
  ) THEN
    ALTER TABLE dividends ADD COLUMN gross_dividend_per_share numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'net_dividend_per_share'
  ) THEN
    ALTER TABLE dividends ADD COLUMN net_dividend_per_share numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividends' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE dividends ADD COLUMN quantity numeric DEFAULT 0;
  END IF;
END $$;