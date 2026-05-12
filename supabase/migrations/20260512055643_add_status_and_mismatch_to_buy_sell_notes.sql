/*
  # Add status tracking to buy_sell_notes

  ## Changes
  - `status` column: tracks whether a note is PROCESSED (cash ledger updated) or PENDING_APPROVAL
    (mismatches found, sent for review) or APPROVED (approved after review).
  - Default is 'PROCESSED' for backwards compatibility with existing rows.
  - `has_mismatch` boolean: quick flag set during processing if any validation field mismatches.
  - `approval_notes` text: reviewer notes when approving a pending note.
  - `approved_by` / `approved_at`: audit trail for approval action.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'status'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN status text NOT NULL DEFAULT 'PROCESSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'has_mismatch'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN has_mismatch boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'approval_notes'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN approval_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN approved_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buy_sell_notes' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE buy_sell_notes ADD COLUMN approved_at timestamptz;
  END IF;
END $$;
