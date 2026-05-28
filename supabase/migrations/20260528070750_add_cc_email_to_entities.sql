/*
  # Add CC Email to Entities

  Adds a dedicated `cc_email` column to the `entities` table.
  This is used to automatically pre-populate the CC field when
  sending transaction emails from the portfolio management system.

  ## Changes
  - `entities`: new nullable `cc_email` (text) column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'cc_email'
  ) THEN
    ALTER TABLE entities ADD COLUMN cc_email text;
  END IF;
END $$;
