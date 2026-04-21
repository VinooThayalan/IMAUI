/*
  # Entity Share Opening Balances

  1. New Tables
    - `entity_share_opening_balances`
      - `id` (uuid) - Primary key
      - `entity_id` (uuid) - Reference to entities. The entity that holds the shares
      - `share_id` (uuid) - Reference to shares. The share being held
      - `opening_shares` (numeric) - Opening number of shares held
      - `effective_date` (date) - The date from which the opening balance is effective
      - `average_purchase_cost` (numeric) - Average purchase cost per share in LKR
      - `notes` (text, nullable) - Optional notes
      - `created_by` (uuid, nullable) - auth user who created the record
      - `created_at` (timestamptz) - Record creation time
      - `updated_at` (timestamptz) - Record update time

    A unique constraint on (entity_id, share_id) ensures a single opening
    balance row per entity/share pair. Editing the opening balance simply
    updates this row.

  2. Security
    - Enable RLS
    - Authenticated users can select, insert, update, delete
    - Aligned with the project's existing open-authenticated policy pattern

  3. Indexes
    - Unique index on (entity_id, share_id)
    - Supporting indexes on entity_id and share_id
*/

CREATE TABLE IF NOT EXISTS entity_share_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  share_id uuid NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  opening_shares numeric(18,4) NOT NULL DEFAULT 0 CHECK (opening_shares >= 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  average_purchase_cost numeric(18,4) NOT NULL DEFAULT 0 CHECK (average_purchase_cost >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_entity_share_opening
  ON entity_share_opening_balances(entity_id, share_id);

CREATE INDEX IF NOT EXISTS idx_esob_entity ON entity_share_opening_balances(entity_id);
CREATE INDEX IF NOT EXISTS idx_esob_share ON entity_share_opening_balances(share_id);

ALTER TABLE entity_share_opening_balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_share_opening_balances'
      AND policyname = 'Authenticated users can view opening balances'
  ) THEN
    CREATE POLICY "Authenticated users can view opening balances"
      ON entity_share_opening_balances FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_share_opening_balances'
      AND policyname = 'Authenticated users can insert opening balances'
  ) THEN
    CREATE POLICY "Authenticated users can insert opening balances"
      ON entity_share_opening_balances FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_share_opening_balances'
      AND policyname = 'Authenticated users can update opening balances'
  ) THEN
    CREATE POLICY "Authenticated users can update opening balances"
      ON entity_share_opening_balances FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_share_opening_balances'
      AND policyname = 'Authenticated users can delete opening balances'
  ) THEN
    CREATE POLICY "Authenticated users can delete opening balances"
      ON entity_share_opening_balances FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_esob_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_esob_updated_at ON entity_share_opening_balances;
CREATE TRIGGER trg_esob_updated_at
  BEFORE UPDATE ON entity_share_opening_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_esob_updated_at();
