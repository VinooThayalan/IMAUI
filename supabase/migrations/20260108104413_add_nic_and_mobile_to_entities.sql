/*
  # Add NIC/Company ID and Contact Mobile to Entities

  1. Changes
    - Add `nic_company_id` column to `entities` table (text, nullable)
    - Add `contact_mobile` column to `entities` table (text, nullable)
    - Add `tax_id` column to `entities` table (text, nullable) - for completeness
    - Add `contact_phone` column to `entities` table (text, nullable)
    - Add `contact_email` column to `entities` table (text, nullable)
    - Add `manager` column to `entities` table (text, nullable)
    - Add `address` column to `entities` table (text, nullable)

  2. Notes
    - These fields enhance entity profile information
    - All fields are nullable to allow gradual data entry
    - NIC/Company ID is for identification purposes
    - Contact mobile provides additional contact method
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE entities ADD COLUMN tax_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'nic_company_id'
  ) THEN
    ALTER TABLE entities ADD COLUMN nic_company_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'manager'
  ) THEN
    ALTER TABLE entities ADD COLUMN manager text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'address'
  ) THEN
    ALTER TABLE entities ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE entities ADD COLUMN contact_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE entities ADD COLUMN contact_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'contact_mobile'
  ) THEN
    ALTER TABLE entities ADD COLUMN contact_mobile text;
  END IF;
END $$;