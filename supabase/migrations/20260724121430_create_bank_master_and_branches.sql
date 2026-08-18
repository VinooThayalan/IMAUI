/*
# Create bank_master and bank_branches tables

1. New Tables
- `bank_master`: the list of banks used by the Bank Master screen.
  - id (uuid, primary key)
  - bank_name (text, not null)
  - bank_code (text, nullable)
  - is_active (boolean, default true)
  - created_at (timestamptz, default now())

- `bank_branches`: branches belonging to a bank.
  - id (uuid, primary key)
  - bank_master_id (uuid, not null) — references bank_master(id)
  - branch_name (text, not null)
  - branch_code (text, nullable)
  - is_active (boolean, default true)
  - created_at (timestamptz, default now())

2. Why this migration exists
   Both tables were created directly on the original hosted database and no
   migration ever captured them, so they were absent on a fresh self-hosted
   install. src/pages/BankMaster.tsx reads and writes both, and
   20260803060003_restrict_reference_table_writes_to_admins creates policies on
   them, which failed with:
       ERROR: relation "public.bank_branches" does not exist

   The column set is taken from the BankMasterItem and BankBranch interfaces in
   src/pages/BankMaster.tsx, which are what the app selects and inserts.

3. Security
- RLS enabled on both tables.
- Authenticated users may read; permissive write policies are created here and
  are deliberately replaced with admin-only ones by
  20260803060003_restrict_reference_table_writes_to_admins, which runs later.
- anon is revoked explicitly. This matters: default privileges in this database
  grant anon full CRUD (arwdDxtm) on every new table in public, and
  20260803060001_revoke_all_anon_access only sweeps tables that exist when it
  runs. Without these REVOKEs a table created afterwards would be readable and
  writable by anyone with the publishable key.

4. Notes
- No UNIQUE constraint is declared on bank_name or bank_code. The original
  hosted definition could not be confirmed, and the app does not depend on one.
  Add them if the real schema had them.
*/

CREATE TABLE IF NOT EXISTS public.bank_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  bank_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_master_id uuid NOT NULL REFERENCES public.bank_master(id) ON DELETE CASCADE,
  branch_name text NOT NULL,
  branch_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fk_bank_branches_bank_master_id
  ON public.bank_branches (bank_master_id);

ALTER TABLE public.bank_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_branches ENABLE ROW LEVEL SECURITY;

-- bank_master
DROP POLICY IF EXISTS "select_bank_master" ON public.bank_master;
CREATE POLICY "select_bank_master"
  ON public.bank_master FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_bank_master" ON public.bank_master;
CREATE POLICY "insert_bank_master"
  ON public.bank_master FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_bank_master" ON public.bank_master;
CREATE POLICY "update_bank_master"
  ON public.bank_master FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_bank_master" ON public.bank_master;
CREATE POLICY "delete_bank_master"
  ON public.bank_master FOR DELETE
  TO authenticated USING (true);

-- bank_branches
DROP POLICY IF EXISTS "select_bank_branches" ON public.bank_branches;
CREATE POLICY "select_bank_branches"
  ON public.bank_branches FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_bank_branches" ON public.bank_branches;
CREATE POLICY "insert_bank_branches"
  ON public.bank_branches FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_bank_branches" ON public.bank_branches;
CREATE POLICY "update_bank_branches"
  ON public.bank_branches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_bank_branches" ON public.bank_branches;
CREATE POLICY "delete_bank_branches"
  ON public.bank_branches FOR DELETE
  TO authenticated USING (true);

-- Keep anon out, regardless of default privileges (see note 3 above).
REVOKE ALL ON public.bank_master FROM anon;
REVOKE ALL ON public.bank_branches FROM anon;
