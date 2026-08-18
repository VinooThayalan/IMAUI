/*
  # Add the bank_master / bank_branches foreign keys the app already writes

  1. Columns added
     - `banks.bank_master_id`          uuid -> bank_master(id)
     - `banks.bank_branch_id`          uuid -> bank_branches(id)
     - `entity_brokers.bank_master_id` uuid -> bank_master(id)
     - `entity_brokers.bank_branch_id` uuid -> bank_branches(id)

  2. Why this migration exists
     Same cause as 20260724121430_create_bank_master_and_branches.sql: the bank
     master feature was built directly on the original hosted database and no
     migration captured any of it. That file recovered the two tables; these
     four columns were missed, because SELF_HOSTED_MIGRATION.md section 5 only
     checked which *tables* the app reaches, not which *columns*.

     The app has been writing and reading them all along:

       src/pages/Banks.tsx:157-158     writes both banks columns
       src/pages/Banks.tsx:91-92       embeds through them:
                                         bank_master:bank_master_id(...)
                                         bank_branch:bank_branch_id(...)
       src/pages/Entities.tsx:399-400  writes both entity_brokers columns

     PostgREST resolves an embed through the foreign key, so without the
     constraint the Banks.tsx query fails as a whole. Its loadData() checks
     every result and throws on the first error, so the failure took the
     entity, bank-master and branch dropdowns down with it — the Entity
     dropdown on Entity - Bank appeared empty, with the real cause only in the
     browser console.

  3. Types and delete behaviour
     uuid to match bank_master.id and bank_branches.id, nullable because both
     screens send null when nothing is picked, and ON DELETE SET NULL to match
     the existing banks.entity_id convention from the base schema — removing a
     bank from the master list must not delete an entity's account rows.

  4. Security
     No policy changes. RLS on banks and entity_brokers is entity-scoped by
     20260803060002_scope_entity_owned_table_writes and applies per row, so
     new columns are covered by the existing policies.
*/

ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS bank_master_id uuid REFERENCES public.bank_master(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_branch_id uuid REFERENCES public.bank_branches(id) ON DELETE SET NULL;

ALTER TABLE public.entity_brokers
  ADD COLUMN IF NOT EXISTS bank_master_id uuid REFERENCES public.bank_master(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_branch_id uuid REFERENCES public.bank_branches(id) ON DELETE SET NULL;

-- Index every foreign key, matching the idx_fk_<table>_<column> convention
-- established by 20260401200105_add_fk_indexes_and_drop_unused.
CREATE INDEX IF NOT EXISTS idx_fk_banks_bank_master_id
  ON public.banks (bank_master_id);
CREATE INDEX IF NOT EXISTS idx_fk_banks_bank_branch_id
  ON public.banks (bank_branch_id);
CREATE INDEX IF NOT EXISTS idx_fk_entity_brokers_bank_master_id
  ON public.entity_brokers (bank_master_id);
CREATE INDEX IF NOT EXISTS idx_fk_entity_brokers_bank_branch_id
  ON public.entity_brokers (bank_branch_id);

-- PostgREST caches the schema, including which foreign keys it can embed
-- through. Without this it keeps rejecting the Banks.tsx embed until the
-- container is restarted.
NOTIFY pgrst, 'reload schema';
