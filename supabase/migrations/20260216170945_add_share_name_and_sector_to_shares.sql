/*
  # Add Share Name and Sector to Shares Table

  1. Changes
    - Add `share_name` (text) - Full name of the share/company
    - Add `sector_id` (uuid, foreign key) - Reference to sector_types table

  2. Notes
    - Uses IF NOT EXISTS to prevent errors if columns already exist
    - Adds foreign key constraint to sector_types
*/

-- Add share_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'share_name'
  ) THEN
    ALTER TABLE shares ADD COLUMN share_name text;
  END IF;
END $$;

-- Add sector_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'sector_id'
  ) THEN
    ALTER TABLE shares ADD COLUMN sector_id uuid REFERENCES sector_types(id);
  END IF;
END $$;