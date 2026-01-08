/*
  # Add GIS Code to Shares Table

  1. Changes
    - Add `gis_code` column to `shares` table (text, nullable)

  2. Notes
    - GIS Code is used for share identification
    - Field is nullable to allow gradual data entry
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'gis_code'
  ) THEN
    ALTER TABLE shares ADD COLUMN gis_code text;
  END IF;
END $$;