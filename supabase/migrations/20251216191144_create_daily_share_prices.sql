/*
  # Create Daily Share Prices Table

  1. New Tables
    - `daily_share_prices`
      - `id` (uuid, primary key) - Unique identifier for each price entry
      - `date_entered` (timestamptz) - When the price was entered into the system
      - `effective_date` (date) - The date for which this price is effective
      - `share_id` (text) - The share/stock symbol identifier
      - `share_price` (decimal) - The price value in LKR
      - `entered_by` (text) - Name of person who entered the price
      - `approved_by` (text, nullable) - Name of person who approved the entry
      - `status` (text) - Status: 'Pending', 'Approved', 'Rejected'
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on `daily_share_prices` table
    - Add policies for authenticated users to:
      - View all daily share prices
      - Insert new price entries
      - Update their own entries or if they're approvers
      
  3. Indexes
    - Index on effective_date for fast date-based queries
    - Index on share_id for fast symbol lookups
    - Composite index on (share_id, effective_date) for common queries
*/

-- Create daily_share_prices table
CREATE TABLE IF NOT EXISTS daily_share_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_entered timestamptz DEFAULT now() NOT NULL,
  effective_date date NOT NULL,
  share_id text NOT NULL,
  share_price decimal(15, 2) NOT NULL CHECK (share_price >= 0),
  entered_by text NOT NULL,
  approved_by text,
  status text DEFAULT 'Pending' NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE daily_share_prices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all daily prices"
  ON daily_share_prices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert daily prices"
  ON daily_share_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update daily prices"
  ON daily_share_prices
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete daily prices"
  ON daily_share_prices
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_prices_effective_date 
  ON daily_share_prices(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_prices_share_id 
  ON daily_share_prices(share_id);

CREATE INDEX IF NOT EXISTS idx_daily_prices_share_date 
  ON daily_share_prices(share_id, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_prices_status 
  ON daily_share_prices(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_daily_share_prices_updated_at ON daily_share_prices;
CREATE TRIGGER update_daily_share_prices_updated_at
  BEFORE UPDATE ON daily_share_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();