/*
  # Add Approval Workflow to Transactions

  1. Changes to transactions table
    - Add approval_status column (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED)
    - Add submitted_for_approval_at timestamp
    - Add approval_validity_hours (duration for approval)
    - Add approval_expires_at timestamp
    - Add submitted_by (user who submitted for approval)
    - Add approved_by (user who approved/rejected)
    - Add approval_date timestamp
    - Add approval_notes text
    - Add rejection_reason text

  2. Purpose
    - Allows transactions to be submitted for approval
    - Tracks approval workflow and validity period
    - Supports multi-user approval process
*/

-- Add approval workflow columns to transactions table
DO $$
BEGIN
  -- Add approval_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_status text DEFAULT 'APPROVED';
  END IF;

  -- Add submitted_for_approval_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'submitted_for_approval_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN submitted_for_approval_at timestamptz;
  END IF;

  -- Add approval_validity_hours
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'approval_validity_hours'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_validity_hours integer;
  END IF;

  -- Add approval_expires_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'approval_expires_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_expires_at timestamptz;
  END IF;

  -- Add submitted_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'submitted_by'
  ) THEN
    ALTER TABLE transactions ADD COLUMN submitted_by text;
  END IF;

  -- Add approved_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approved_by text;
  END IF;

  -- Add approval_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'approval_date'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_date timestamptz;
  END IF;

  -- Add approval_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'approval_notes'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_notes text;
  END IF;

  -- Add rejection_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE transactions ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Create index for approval status queries
CREATE INDEX IF NOT EXISTS idx_transactions_approval_status ON transactions(approval_status);
CREATE INDEX IF NOT EXISTS idx_transactions_approval_expires_at ON transactions(approval_expires_at);

-- Add check constraint for approval_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_approval_status_check'
  ) THEN
    ALTER TABLE transactions
    ADD CONSTRAINT transactions_approval_status_check
    CHECK (approval_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED'));
  END IF;
END $$;
