/*
  # Create Share Analytics Tables with Historical Tracking

  1. New Tables
    - `share_52week_values`
      - `id` (uuid, primary key) - Unique identifier
      - `share_id` (text) - Foreign key to shares table
      - `high_value` (decimal) - 52-week high value
      - `low_value` (decimal) - 52-week low value
      - `effective_date` (date) - Date when these values are effective (latest date considered)
      - `timestamp` (timestamptz) - When this record was created
      - `created_by` (text) - User who created the record
      - `notes` (text, nullable) - Optional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

    - `share_earnings`
      - `id` (uuid, primary key) - Unique identifier
      - `entity_id` (text) - Entity this earning belongs to
      - `share_id` (text) - Share identifier
      - `effective_date` (date) - Date when this earning data is effective
      - `earnings_per_share` (decimal) - Calculated EPS value
      - `price_earning_ratio` (decimal) - Calculated P/E ratio
      - `timestamp` (timestamptz) - When this record was created
      - `created_by` (text) - User who created the record
      - `notes` (text, nullable) - Optional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

    - `share_values`
      - `id` (uuid, primary key) - Unique identifier
      - `entity_id` (text) - Entity this valuation belongs to
      - `share_id` (text) - Share identifier
      - `effective_date` (date) - Date when this valuation is effective
      - `netbook_value_per_share` (decimal) - Calculated net book value per share
      - `price_to_book_ratio` (decimal) - Calculated P/B ratio
      - `timestamp` (timestamptz) - When this record was created
      - `created_by` (text) - User who created the record
      - `notes` (text, nullable) - Optional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

    - `share_dividends_per_share`
      - `id` (uuid, primary key) - Unique identifier
      - `entity_id` (text) - Entity this dividend belongs to
      - `share_id` (text) - Share identifier
      - `effective_date` (date) - Date when this dividend data is effective
      - `dividend_per_share_gross` (decimal) - Calculated gross dividend per share
      - `dividend_per_share_net` (decimal) - Calculated net dividend per share
      - `dividend_yield` (decimal) - Calculated dividend yield percentage
      - `timestamp` (timestamptz) - When this record was created
      - `created_by` (text) - User who created the record
      - `notes` (text, nullable) - Optional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to:
      - View all historical records
      - Insert new records
      - Update existing records
      - Delete records

  3. Indexes
    - Index on share_id for quick lookups
    - Index on entity_id for filtering by entity
    - Index on effective_date for date-based queries
    - Index on timestamp for chronological queries
    - Composite indexes for common query patterns

  4. Important Notes
    - All tables maintain complete history - records are never deleted, only new ones are added
    - The effective_date represents when the data is valid/applicable
    - The timestamp represents when the record was created in the system
    - This dual-date approach allows for historical reporting and audit trails
*/

-- Create 52-week share values table
CREATE TABLE IF NOT EXISTS share_52week_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id text NOT NULL,
  high_value decimal(15, 2) NOT NULL CHECK (high_value >= 0),
  low_value decimal(15, 2) NOT NULL CHECK (low_value >= 0),
  effective_date date NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_high_low CHECK (high_value >= low_value)
);

-- Create share earnings table
CREATE TABLE IF NOT EXISTS share_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL,
  share_id text NOT NULL,
  effective_date date NOT NULL,
  earnings_per_share decimal(15, 4) NOT NULL,
  price_earning_ratio decimal(15, 4) NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create share values table
CREATE TABLE IF NOT EXISTS share_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL,
  share_id text NOT NULL,
  effective_date date NOT NULL,
  netbook_value_per_share decimal(15, 4) NOT NULL,
  price_to_book_ratio decimal(15, 4) NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create share dividends per share table
CREATE TABLE IF NOT EXISTS share_dividends_per_share (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL,
  share_id text NOT NULL,
  effective_date date NOT NULL,
  dividend_per_share_gross decimal(15, 4) NOT NULL CHECK (dividend_per_share_gross >= 0),
  dividend_per_share_net decimal(15, 4) NOT NULL CHECK (dividend_per_share_net >= 0),
  dividend_yield decimal(10, 4) NOT NULL CHECK (dividend_yield >= 0),
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE share_52week_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_dividends_per_share ENABLE ROW LEVEL SECURITY;

-- Create policies for share_52week_values
CREATE POLICY "Authenticated users can view 52-week values"
  ON share_52week_values
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert 52-week values"
  ON share_52week_values
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update 52-week values"
  ON share_52week_values
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete 52-week values"
  ON share_52week_values
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for share_earnings
CREATE POLICY "Authenticated users can view earnings"
  ON share_earnings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert earnings"
  ON share_earnings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update earnings"
  ON share_earnings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete earnings"
  ON share_earnings
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for share_values
CREATE POLICY "Authenticated users can view share values"
  ON share_values
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert share values"
  ON share_values
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update share values"
  ON share_values
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete share values"
  ON share_values
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for share_dividends_per_share
CREATE POLICY "Authenticated users can view dividends per share"
  ON share_dividends_per_share
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert dividends per share"
  ON share_dividends_per_share
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update dividends per share"
  ON share_dividends_per_share
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete dividends per share"
  ON share_dividends_per_share
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for share_52week_values
CREATE INDEX IF NOT EXISTS idx_52week_share_id 
  ON share_52week_values(share_id);

CREATE INDEX IF NOT EXISTS idx_52week_effective_date 
  ON share_52week_values(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_52week_timestamp 
  ON share_52week_values(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_52week_share_date 
  ON share_52week_values(share_id, effective_date DESC);

-- Create indexes for share_earnings
CREATE INDEX IF NOT EXISTS idx_earnings_entity_id 
  ON share_earnings(entity_id);

CREATE INDEX IF NOT EXISTS idx_earnings_share_id 
  ON share_earnings(share_id);

CREATE INDEX IF NOT EXISTS idx_earnings_effective_date 
  ON share_earnings(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_earnings_timestamp 
  ON share_earnings(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_earnings_entity_share_date 
  ON share_earnings(entity_id, share_id, effective_date DESC);

-- Create indexes for share_values
CREATE INDEX IF NOT EXISTS idx_values_entity_id 
  ON share_values(entity_id);

CREATE INDEX IF NOT EXISTS idx_values_share_id 
  ON share_values(share_id);

CREATE INDEX IF NOT EXISTS idx_values_effective_date 
  ON share_values(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_values_timestamp 
  ON share_values(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_values_entity_share_date 
  ON share_values(entity_id, share_id, effective_date DESC);

-- Create indexes for share_dividends_per_share
CREATE INDEX IF NOT EXISTS idx_div_per_share_entity_id 
  ON share_dividends_per_share(entity_id);

CREATE INDEX IF NOT EXISTS idx_div_per_share_share_id 
  ON share_dividends_per_share(share_id);

CREATE INDEX IF NOT EXISTS idx_div_per_share_effective_date 
  ON share_dividends_per_share(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_div_per_share_timestamp 
  ON share_dividends_per_share(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_div_per_share_entity_share_date 
  ON share_dividends_per_share(entity_id, share_id, effective_date DESC);

-- Create triggers for updated_at on all tables
DROP TRIGGER IF EXISTS update_52week_updated_at ON share_52week_values;
CREATE TRIGGER update_52week_updated_at
  BEFORE UPDATE ON share_52week_values
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_balance_updated_at();

DROP TRIGGER IF EXISTS update_earnings_updated_at ON share_earnings;
CREATE TRIGGER update_earnings_updated_at
  BEFORE UPDATE ON share_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_balance_updated_at();

DROP TRIGGER IF EXISTS update_values_updated_at ON share_values;
CREATE TRIGGER update_values_updated_at
  BEFORE UPDATE ON share_values
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_balance_updated_at();

DROP TRIGGER IF EXISTS update_dividends_per_share_updated_at ON share_dividends_per_share;
CREATE TRIGGER update_dividends_per_share_updated_at
  BEFORE UPDATE ON share_dividends_per_share
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_balance_updated_at();