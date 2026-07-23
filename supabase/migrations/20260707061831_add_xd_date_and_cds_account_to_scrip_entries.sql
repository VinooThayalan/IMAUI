ALTER TABLE scrip_entries
  ADD COLUMN IF NOT EXISTS xd_date date,
  ADD COLUMN IF NOT EXISTS cds_account text;