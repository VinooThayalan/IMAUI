/*
  # Update entity_brokers: nullable broker_id and custodian_account_fee

  1. Changes
    - Make `broker_id` nullable in `entity_brokers` (custodian accounts don't require a specific broker)
    - Add `custodian_account_fee` (numeric) column to store custodian account fee percentage

  2. Notes
    - Custodian accounts apply to all brokers, so broker_id is not required for them
    - custodian_account_fee stores the fee as a percentage (e.g., 0.25 for 0.25%)
*/

ALTER TABLE entity_brokers ALTER COLUMN broker_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_brokers' AND column_name = 'custodian_account_fee'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN custodian_account_fee numeric(10,4);
  END IF;
END $$;
