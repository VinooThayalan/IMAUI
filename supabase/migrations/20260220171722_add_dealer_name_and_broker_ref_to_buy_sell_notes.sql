/*
  # Add Dealer Name and Broker Reference to Buy Sell Notes

  ## Changes Made
  
  1. Modifications to buy_sell_notes table
    - Add `broker_id` (uuid, foreign key) - References brokers table (optional)
    - Add `dealer_name` (text) - Name of the dealer handling the transaction
    - Keep existing `broker` field for backward compatibility
  
  2. Purpose
    - Allow linking buy/sell notes to brokers from the brokers table
    - Track dealer name separately from broker
    - Provide more detailed tracking of transaction handlers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'buy_sell_notes' AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN broker_id uuid REFERENCES brokers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'buy_sell_notes' AND column_name = 'dealer_name'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN dealer_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_buy_sell_notes_broker_id ON buy_sell_notes(broker_id);
