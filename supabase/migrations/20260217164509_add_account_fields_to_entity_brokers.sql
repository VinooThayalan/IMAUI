/*
  # Add Account Fields to Entity Brokers

  1. Changes
    - Add account-related fields to `entity_brokers` table
    - For Custodian Accounts:
      - custodian_account_number (text)
      - custodian_account_name (text)
    - For Broker Accounts:
      - broker_account_number (text)
    - Common fields for both:
      - bank_id (uuid, foreign key to banks)
      - currency (text)
      - bank_account_number (text)
      - facility_limit (decimal)
      - broker_name_id (uuid, foreign key to brokers) - for custodian accounts
      - broker_text (text) - for broker accounts
*/

-- Add new columns to entity_brokers table
DO $$
BEGIN
  -- Custodian-specific fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'custodian_account_number'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN custodian_account_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'custodian_account_name'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN custodian_account_name text;
  END IF;

  -- Broker-specific fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'broker_account_number'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN broker_account_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'broker_text'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN broker_text text;
  END IF;

  -- Common fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'bank_id'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN bank_id uuid REFERENCES banks(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'currency'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN currency text DEFAULT 'LKR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'bank_account_number'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN bank_account_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'facility_limit'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN facility_limit decimal(20, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_brokers' AND column_name = 'broker_name_id'
  ) THEN
    ALTER TABLE entity_brokers ADD COLUMN broker_name_id uuid REFERENCES brokers(id);
  END IF;
END $$;

-- Create index for bank_id lookups
CREATE INDEX IF NOT EXISTS idx_entity_brokers_bank_id ON entity_brokers(bank_id);
CREATE INDEX IF NOT EXISTS idx_entity_brokers_broker_name_id ON entity_brokers(broker_name_id);
