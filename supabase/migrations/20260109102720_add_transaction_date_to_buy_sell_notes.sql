/*
  # Add Transaction Date to Buy/Sell Notes

  1. Changes to buy_sell_notes table
    - Add `transaction_date` (date) - The date of the transaction
    
  2. Notes
    - This field will be used to track when the actual transaction occurred
    - Will be displayed in the form and used for record-keeping
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'transaction_date'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN transaction_date date;
  END IF;
END $$;