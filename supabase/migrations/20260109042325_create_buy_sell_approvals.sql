/*
  # Create Buy and Sell Approvals Table

  1. New Tables
    - `buy_sell_approvals`
      - `id` (uuid, primary key) - Unique identifier
      - `buy_sell_note_id` (uuid, foreign key) - Links to buy_sell_notes table
      - `status` (text) - 'Pending', 'Approved', 'Rejected', 'On Hold'
      - `submitted_by` (text) - User who submitted for approval
      - `submitted_date` (timestamptz) - When submitted for approval
      - `reviewed_by` (text) - User who reviewed the document
      - `reviewed_date` (timestamptz) - When reviewed
      - `remarks` (text) - Reviewer's comments or rejection reason
      - `priority` (text) - 'Low', 'Medium', 'High'
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `buy_sell_approvals` table
    - Add policies for authenticated users to view, insert, update, and delete approvals

  3. Indexes
    - Add index on buy_sell_note_id for faster lookups
    - Add index on status for filtering
    - Add index on submitted_date for sorting
*/

CREATE TABLE IF NOT EXISTS buy_sell_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_sell_note_id uuid REFERENCES buy_sell_notes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'On Hold')),
  submitted_by text NOT NULL,
  submitted_date timestamptz DEFAULT now(),
  reviewed_by text,
  reviewed_date timestamptz,
  remarks text,
  priority text DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE buy_sell_approvals ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view buy sell approvals"
  ON buy_sell_approvals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert buy sell approvals"
  ON buy_sell_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update buy sell approvals"
  ON buy_sell_approvals
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete buy sell approvals"
  ON buy_sell_approvals
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_buy_sell_approvals_note_id ON buy_sell_approvals(buy_sell_note_id);
CREATE INDEX IF NOT EXISTS idx_buy_sell_approvals_status ON buy_sell_approvals(status);
CREATE INDEX IF NOT EXISTS idx_buy_sell_approvals_submitted_date ON buy_sell_approvals(submitted_date);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_buy_sell_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_buy_sell_approvals_updated_at
  BEFORE UPDATE ON buy_sell_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_buy_sell_approvals_updated_at();