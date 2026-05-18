/*
  # Add CANCELLED to transactions approval_status CHECK constraint

  ## Problem
  The approval_status column has a CHECK constraint that only allows:
  DRAFT, PENDING_APPROVAL, APPROVED, AUTO_APPROVED, REJECTED, EXPIRED
  
  CANCELLED is missing from this list, causing every cancel attempt to fail
  with a constraint violation regardless of RLS policies.

  ## Change
  Drop and recreate the CHECK constraint to include CANCELLED.
*/

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_approval_status_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_approval_status_check
  CHECK (approval_status = ANY (ARRAY[
    'DRAFT'::text,
    'PENDING_APPROVAL'::text,
    'APPROVED'::text,
    'AUTO_APPROVED'::text,
    'REJECTED'::text,
    'EXPIRED'::text,
    'CANCELLED'::text
  ]));
