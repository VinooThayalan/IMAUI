/*
  # Add Brokerage Fee Type to Buy Sell Notes

  1. Changes
    - Add `brokerage_fee_type_id` column to `buy_sell_notes` table
      - References `brokerage_fee_types` table
      - Optional field (nullable) to allow existing records to continue working
      - Foreign key constraint with ON DELETE SET NULL

  2. Indexes
    - Add index on brokerage_fee_type_id for faster lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'brokerage_fee_type_id'
  ) THEN
    ALTER TABLE buy_sell_notes
    ADD COLUMN brokerage_fee_type_id uuid REFERENCES brokerage_fee_types(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_buy_sell_notes_brokerage_fee_type
    ON buy_sell_notes(brokerage_fee_type_id);
  END IF;
END $$;