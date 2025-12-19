/*
  # Create Buy and Sell Notes Table

  1. New Tables
    - `buy_sell_notes`
      - `id` (uuid, primary key) - Unique identifier
      - `transaction_id` (uuid, foreign key) - Links to transactions table
      - `note_type` (text) - 'Buy' or 'Sell'
      - `note_number` (text) - Contract note number
      - `broker` (text) - Broker name
      - `settlement_date` (date) - Settlement date
      - `file_url` (text, optional) - URL to uploaded document
      - `remarks` (text, optional) - Additional notes
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `buy_sell_notes` table
    - Add policies for authenticated users to:
      - View all notes
      - Insert new notes
      - Update existing notes
      - Delete notes

  3. Indexes
    - Add index on transaction_id for faster lookups
    - Add index on note_type for filtering
*/

CREATE TABLE IF NOT EXISTS buy_sell_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  note_type text NOT NULL CHECK (note_type IN ('Buy', 'Sell')),
  note_number text NOT NULL,
  broker text NOT NULL,
  settlement_date date NOT NULL,
  file_url text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE buy_sell_notes ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view buy sell notes"
  ON buy_sell_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert buy sell notes"
  ON buy_sell_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update buy sell notes"
  ON buy_sell_notes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete buy sell notes"
  ON buy_sell_notes
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_buy_sell_notes_transaction_id ON buy_sell_notes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_buy_sell_notes_note_type ON buy_sell_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_buy_sell_notes_settlement_date ON buy_sell_notes(settlement_date);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_buy_sell_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_buy_sell_notes_updated_at
  BEFORE UPDATE ON buy_sell_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_buy_sell_notes_updated_at();
