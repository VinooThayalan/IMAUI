/*
  # Add Current Balance to Entities

  1. Changes
    - Add `current_balance` column to `entities` table to track real-time balance
    - Set default value to 0 with NOT NULL constraint
    - Update existing entities to have 0 balance initially

  2. Purpose
    - Enable tracking of current cash balance for each entity
    - Support real-time balance updates from cash transactions
*/

-- Add current_balance column to entities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE entities ADD COLUMN current_balance decimal(15, 2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_entities_current_balance 
  ON entities(current_balance);
