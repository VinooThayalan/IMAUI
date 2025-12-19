/*
  # Transaction Approvals and Scrip Entry System

  1. New Tables
    - `transaction_requests`
      - `id` (uuid, primary key)
      - `entity_id` (uuid, foreign key to entities)
      - `share_id` (uuid, foreign key to shares)
      - `transaction_type` (text: BUY/SELL/DIVIDEND/SCRIP/COST)
      - `no_of_shares` (numeric)
      - `price_per_share` (numeric)
      - `total_amount` (numeric)
      - `request_date` (date)
      - `status` (text: PENDING/APPROVED/REJECTED)
      - `requested_by` (text)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `transaction_approvals`
      - `id` (uuid, primary key)
      - `transaction_request_id` (uuid, foreign key)
      - `approved_by` (text)
      - `approval_date` (timestamptz)
      - `approval_notes` (text)
      - `supporting_document_url` (text)
      - `created_at` (timestamptz)

    - `transaction_documents`
      - `id` (uuid, primary key)
      - `transaction_request_id` (uuid, foreign key)
      - `document_type` (text: SUPPORTING_DOC/CONFIRMATION_DOC)
      - `document_url` (text)
      - `uploaded_by` (text)
      - `uploaded_at` (timestamptz)
      - `file_name` (text)
      - `file_size` (integer)

    - `scrip_entries`
      - `id` (uuid, primary key)
      - `entity_id` (uuid, foreign key to entities)
      - `share_id` (uuid, foreign key to shares)
      - `entry_date` (date)
      - `status` (text)
      - `no_of_shares` (numeric)
      - `transaction_type` (text: BUY/SELL/DIVIDEND/SCRIP/COST)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
*/

-- Create transaction_requests table
CREATE TABLE IF NOT EXISTS transaction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  share_id uuid REFERENCES shares(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'DIVIDEND', 'SCRIP', 'COST')),
  no_of_shares numeric NOT NULL DEFAULT 0,
  price_per_share numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transaction_approvals table
CREATE TABLE IF NOT EXISTS transaction_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_request_id uuid REFERENCES transaction_requests(id) ON DELETE CASCADE,
  approved_by text NOT NULL DEFAULT '',
  approval_date timestamptz DEFAULT now(),
  approval_notes text DEFAULT '',
  supporting_document_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create transaction_documents table
CREATE TABLE IF NOT EXISTS transaction_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_request_id uuid REFERENCES transaction_requests(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('SUPPORTING_DOC', 'CONFIRMATION_DOC')),
  document_url text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL DEFAULT '',
  uploaded_at timestamptz DEFAULT now(),
  file_name text NOT NULL DEFAULT '',
  file_size integer DEFAULT 0
);

-- Create scrip_entries table
CREATE TABLE IF NOT EXISTS scrip_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  share_id uuid REFERENCES shares(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'ACTIVE',
  no_of_shares numeric NOT NULL DEFAULT 0,
  transaction_type text NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'DIVIDEND', 'SCRIP', 'COST')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE transaction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrip_entries ENABLE ROW LEVEL SECURITY;

-- Policies for transaction_requests
CREATE POLICY "Allow all operations on transaction_requests"
  ON transaction_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for transaction_approvals
CREATE POLICY "Allow all operations on transaction_approvals"
  ON transaction_approvals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for transaction_documents
CREATE POLICY "Allow all operations on transaction_documents"
  ON transaction_documents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for scrip_entries
CREATE POLICY "Allow all operations on scrip_entries"
  ON scrip_entries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);