/*
  # Correct entity_id columns from text to uuid

  1. Changes
    - `cash_balance_ledger.entity_id`      text -> uuid (nullable)
    - `share_values.entity_id`             text -> uuid (NOT NULL)
    - `share_earnings.entity_id`           text -> uuid (NOT NULL)
    - `share_dividends_per_share.entity_id` text -> uuid (NOT NULL)
    - Adds the matching foreign keys to entities(id)

  2. Why
    These four tables were created with `entity_id text` by the migrations dated
    2025-12-16, but on the original hosted database they were uuid foreign keys
    to entities(id). Evidence: 20260401200105_add_fk_indexes_and_drop_unused
    creates idx_fk_<table>_entity_id for each of them (Supabase's index advisor
    only labels actual foreign-key columns that way), and the next migration
    20260402053443_enforce_entity_level_rls calls has_entity_access(entity_id)
    against them, a function declared as has_entity_access(p_entity_id uuid).
    Replaying onto a fresh database therefore failed with
    "function public.has_entity_access(text) does not exist".

    The application already stores uuids here: CashBalance.tsx inserts
    formData.entityId, which is the entities primary key (it resolves the entity
    with `.eq('id', formData.entityId)`), not the human-readable entities.entity_id
    code such as 'E001'.

  3. Notes
    - Safe as a plain cast: all four tables are empty on a fresh database, and any
      value present would already be a uuid string.
    - Foreign keys are added only when absent, so this is re-runnable.
*/

ALTER TABLE cash_balance_ledger
  ALTER COLUMN entity_id TYPE uuid USING entity_id::uuid;

ALTER TABLE share_values
  ALTER COLUMN entity_id TYPE uuid USING entity_id::uuid;

ALTER TABLE share_earnings
  ALTER COLUMN entity_id TYPE uuid USING entity_id::uuid;

ALTER TABLE share_dividends_per_share
  ALTER COLUMN entity_id TYPE uuid USING entity_id::uuid;

-- Add the foreign keys these columns were missing
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cash_balance_ledger',
    'share_values',
    'share_earnings',
    'share_dividends_per_share'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = t::regclass
        AND contype = 'f'
        AND conname = t || '_entity_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (entity_id) REFERENCES entities(id)',
        t, t || '_entity_id_fkey'
      );
    END IF;
  END LOOP;
END $$;
