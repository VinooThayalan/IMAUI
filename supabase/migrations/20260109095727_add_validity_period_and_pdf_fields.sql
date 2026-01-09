/*
  # Add Validity Period and PDF Upload Support

  1. Changes to transaction_requests table
    - Add `validity_period_hours` (integer) - Number of hours the request is valid for approval
    - Add `expires_at` (timestamptz) - Calculated expiry timestamp for the request
    - Add `pdf_url` (text) - URL to uploaded signed PDF document
    - Add `pdf_uploaded_at` (timestamptz) - When the PDF was uploaded
    - Add `pdf_uploaded_by` (text) - Who uploaded the PDF
    
  2. Notes
    - Validity period helps auto-cancel transactions not approved within timeframe
    - PDF upload allows users to upload signed documents
    - System will check both hold_until and expires_at for auto-cancellation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'validity_period_hours'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN validity_period_hours integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN pdf_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'pdf_uploaded_at'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN pdf_uploaded_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_requests' AND column_name = 'pdf_uploaded_by'
  ) THEN
    ALTER TABLE transaction_requests ADD COLUMN pdf_uploaded_by text;
  END IF;
END $$;