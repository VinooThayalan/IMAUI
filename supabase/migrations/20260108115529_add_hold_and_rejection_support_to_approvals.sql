/*
  # Add Hold and Rejection Support to Transaction Approvals

  1. Changes to transaction_requests
    - Add 'HOLD' and 'CANCELLED' to status enum
    - Add `hold_until` timestamp for tracking when hold expires
    - Add `hold_duration_minutes` integer for tracking hold duration
    - Add `rejection_reason` text field for storing rejection comments
    - Add `edited_by` text field to track who edited the transaction
    - Add `edit_notes` text field to track what was edited
    
  2. Security
    - No RLS changes needed, already enabled on transaction_requests
*/

-- Drop existing check constraint on status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transaction_requests_status_check'
  ) THEN
    ALTER TABLE transaction_requests DROP CONSTRAINT transaction_requests_status_check;
  END IF;
END $$;

-- Add new status values including HOLD and CANCELLED
ALTER TABLE transaction_requests 
ADD CONSTRAINT transaction_requests_status_check 
CHECK (status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'HOLD'::text, 'CANCELLED'::text]));

-- Add hold_until timestamp column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'hold_until'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN hold_until timestamptz;
  END IF;
END $$;

-- Add hold_duration_minutes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'hold_duration_minutes'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN hold_duration_minutes integer;
  END IF;
END $$;

-- Add rejection_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Add edited_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'edited_by'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN edited_by text;
  END IF;
END $$;

-- Add edit_notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'edit_notes'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN edit_notes text;
  END IF;
END $$;

-- Add approved_by and approval_date columns to transaction_requests for easier querying
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN approved_by text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'approval_date'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN approval_date timestamptz;
  END IF;
END $$;