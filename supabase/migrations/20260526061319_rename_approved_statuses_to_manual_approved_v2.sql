/*
  # Rename APPROVED and AUTO_APPROVED to MANUAL_APPROVED

  Drops existing approval_status check constraint, updates all existing rows,
  then re-adds the constraint with MANUAL_APPROVED replacing APPROVED and AUTO_APPROVED.
*/

-- Drop existing constraint first
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_approval_status_check;

-- Update existing rows
UPDATE transactions SET approval_status = 'MANUAL_APPROVED' WHERE approval_status IN ('APPROVED', 'AUTO_APPROVED');

-- Re-add updated constraint
ALTER TABLE transactions ADD CONSTRAINT transactions_approval_status_check
  CHECK (approval_status IN ('DRAFT','PENDING_APPROVAL','MANUAL_APPROVED','REJECTED','EXPIRED','ON_HOLD','CANCELLED'));
