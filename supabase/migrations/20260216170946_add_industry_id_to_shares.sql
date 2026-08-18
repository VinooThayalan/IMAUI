/*
  # Add Industry ID to Shares Table

  1. Changes
    - Add `industry_id` (uuid, foreign key) - Reference to industry_types table

  2. Notes
    - Uses IF NOT EXISTS to prevent errors if the column already exists
    - Mirrors sector_types.industry_id, which references industry_types(id)
    - This column was present on the original hosted database but no migration
      ever created it, so replaying the migrations onto a fresh database failed
      at 20260222170430_add_comprehensive_sample_data_v2 (which writes to it)
      and 20260401200105_add_fk_indexes_and_drop_unused (which indexes it).
      Timestamped to run directly after sector_id is added and before those.
*/

-- Add industry_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'industry_id'
  ) THEN
    ALTER TABLE shares ADD COLUMN industry_id uuid REFERENCES industry_types(id);
  END IF;
END $$;
