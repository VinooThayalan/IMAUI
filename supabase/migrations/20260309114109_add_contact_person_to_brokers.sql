/*
  # Add Contact Person Details to Brokers Table

  1. Changes
    - Add `contact_person_name` (text) - Name of the contact person at the broker
    - Add `contact_person_email` (text) - Email address of the contact person
    - Add `contact_person_phone` (text) - Phone number of the contact person
    - Add `contact_person_designation` (text) - Job title/designation of the contact person
    - Add `contact_person_mobile` (text) - Mobile number of the contact person

  2. Notes
    - All fields are optional to maintain backward compatibility
    - These fields help maintain direct communication channels with broker representatives
*/

-- Add contact person fields to brokers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'contact_person_name'
  ) THEN
    ALTER TABLE brokers ADD COLUMN contact_person_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'contact_person_email'
  ) THEN
    ALTER TABLE brokers ADD COLUMN contact_person_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'contact_person_phone'
  ) THEN
    ALTER TABLE brokers ADD COLUMN contact_person_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'contact_person_designation'
  ) THEN
    ALTER TABLE brokers ADD COLUMN contact_person_designation text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'contact_person_mobile'
  ) THEN
    ALTER TABLE brokers ADD COLUMN contact_person_mobile text;
  END IF;
END $$;