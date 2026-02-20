/*
  # Add Approval Document Support to Transactions

  ## Changes Made
  
  1. New Columns Added to transactions table
    - `approval_document_url` (text) - URL or path to the uploaded approval document
    - `approval_document_name` (text) - Original filename of the uploaded document
    - `approval_document_uploaded_at` (timestamptz) - Timestamp when document was uploaded
    - `approval_document_uploaded_by` (text) - User who uploaded the document
    - `offline_approval` (boolean) - Flag indicating if approval was obtained offline
  
  2. Purpose
    - Allows users to upload proof of approval when approver approves offline
    - Tracks approval document metadata for audit purposes
    - Supports offline approval workflow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'approval_document_url'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_document_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'approval_document_name'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_document_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'approval_document_uploaded_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_document_uploaded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'approval_document_uploaded_by'
  ) THEN
    ALTER TABLE transactions ADD COLUMN approval_document_uploaded_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'offline_approval'
  ) THEN
    ALTER TABLE transactions ADD COLUMN offline_approval boolean DEFAULT false;
  END IF;
END $$;
