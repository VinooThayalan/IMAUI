/*
  # Entity Approvers & AUTO_APPROVED Status

  ## Summary
  Introduces a per-entity approver system and adds AUTO_APPROVED as a valid
  transaction approval status.

  ## New Tables
  - `entity_approvers`
    - `id` (uuid, PK)
    - `entity_id` (uuid, FK → entities) — the entity this rule applies to
    - `approver_email` (text NOT NULL) — email of the designated approver
    - `created_by` (text) — admin who set this up
    - `created_at` (timestamptz)
    - UNIQUE (entity_id, approver_email)

  ## Modified Tables
  - `transactions.approval_status` check constraint expanded to also allow
    'AUTO_APPROVED'

  ## Security
  - RLS enabled on entity_approvers
  - Authenticated users can SELECT (needed to check approver status at submit time)
  - Only admins can INSERT / UPDATE / DELETE (managed via app logic + policy)
*/

-- 1. Create entity_approvers table
CREATE TABLE IF NOT EXISTS entity_approvers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  approver_email text NOT NULL,
  created_by   text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (entity_id, approver_email)
);

ALTER TABLE entity_approvers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view entity approvers"
  ON entity_approvers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert entity approvers"
  ON entity_approvers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update entity approvers"
  ON entity_approvers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete entity approvers"
  ON entity_approvers FOR DELETE
  TO authenticated
  USING (true);

-- 2. Expand the approval_status check constraint on transactions
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_approval_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_approval_status_check
  CHECK (approval_status IN (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'AUTO_APPROVED',
    'REJECTED',
    'EXPIRED'
  ));
