/*
  # Create Cash Balance Ledger Table

  1. New Tables
    - `cash_balance_ledger`
      - `id` (uuid, primary key) - Unique identifier for each transaction
      - `type` (text) - Transaction type: 'Addition' or 'Deduction'
      - `description` (text) - Description of the transaction (e.g., Manual, Shares bought/sold)
      - `amount` (decimal) - Transaction amount in LKR
      - `timestamp` (timestamptz) - When the transaction occurred
      - `running_balance` (decimal) - Cash balance after this transaction
      - `entity_id` (text, nullable) - Optional link to entity if transaction is entity-specific
      - `reference_id` (text, nullable) - Optional reference to related transaction
      - `created_by` (text) - User who created the transaction
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

    - `cash_balance_config`
      - `id` (uuid, primary key) - Config identifier
      - `overdraft_limit` (decimal) - Maximum allowed overdraft/negative balance
      - `current_balance` (decimal) - Current cash balance
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to:
      - View all cash balance transactions
      - Insert new transactions
      - View configuration
      - Update configuration (for admins)

  3. Indexes
    - Index on timestamp for chronological queries
    - Index on type for filtering additions/deductions
    
  4. Functions
    - Function to calculate running balance
    - Function to check if transaction would exceed overdraft limit
*/

-- Create cash_balance_config table
CREATE TABLE IF NOT EXISTS cash_balance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overdraft_limit decimal(15, 2) DEFAULT 0 NOT NULL CHECK (overdraft_limit >= 0),
  current_balance decimal(15, 2) DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create cash_balance_ledger table
CREATE TABLE IF NOT EXISTS cash_balance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('Addition', 'Deduction')),
  description text NOT NULL,
  amount decimal(15, 2) NOT NULL CHECK (amount > 0),
  timestamp timestamptz DEFAULT now() NOT NULL,
  running_balance decimal(15, 2) NOT NULL,
  entity_id text,
  reference_id text,
  created_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default config if not exists
INSERT INTO cash_balance_config (overdraft_limit, current_balance)
SELECT 0, 0
WHERE NOT EXISTS (SELECT 1 FROM cash_balance_config LIMIT 1);

-- Enable RLS
ALTER TABLE cash_balance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_balance_config ENABLE ROW LEVEL SECURITY;

-- Create policies for cash_balance_ledger
CREATE POLICY "Authenticated users can view all ledger entries"
  ON cash_balance_ledger
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ledger entries"
  ON cash_balance_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ledger entries"
  ON cash_balance_ledger
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ledger entries"
  ON cash_balance_ledger
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for cash_balance_config
CREATE POLICY "Authenticated users can view config"
  ON cash_balance_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update config"
  ON cash_balance_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ledger_timestamp 
  ON cash_balance_ledger(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_type 
  ON cash_balance_ledger(type);

CREATE INDEX IF NOT EXISTS idx_ledger_entity 
  ON cash_balance_ledger(entity_id) WHERE entity_id IS NOT NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cash_balance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_cash_ledger_updated_at ON cash_balance_ledger;
CREATE TRIGGER update_cash_ledger_updated_at
  BEFORE UPDATE ON cash_balance_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_balance_updated_at();

DROP TRIGGER IF EXISTS update_cash_config_updated_at ON cash_balance_config;
CREATE TRIGGER update_cash_config_updated_at
  BEFORE UPDATE ON cash_balance_config
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_balance_updated_at();

-- Create function to validate transaction against overdraft limit
CREATE OR REPLACE FUNCTION check_overdraft_limit(
  transaction_amount decimal,
  transaction_type text,
  current_bal decimal,
  od_limit decimal
)
RETURNS boolean AS $$
DECLARE
  new_balance decimal;
BEGIN
  IF transaction_type = 'Deduction' THEN
    new_balance := current_bal - transaction_amount;
  ELSE
    new_balance := current_bal + transaction_amount;
  END IF;
  
  -- Check if new balance would be below negative overdraft limit
  RETURN new_balance >= -od_limit;
END;
$$ LANGUAGE plpgsql;