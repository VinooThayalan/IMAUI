/*
  # Create Entity-Broker Relationship Table

  1. New Tables
    - `entity_brokers`
      - `id` (uuid, primary key)
      - `entity_id` (uuid, foreign key to entities)
      - `broker_id` (uuid, foreign key to brokers)
      - `relationship_type` (text): Type of relationship (e.g., 'Primary Broker', 'Custodian', 'Secondary Broker')
      - `is_active` (boolean): Whether this relationship is currently active
      - `assigned_date` (date): When this relationship was established
      - `notes` (text): Additional notes about the relationship
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `entity_brokers` table
    - Add policy for authenticated users to read all entity-broker relationships
    - Add policy for authenticated users to manage entity-broker relationships

  3. Constraints
    - Unique constraint on entity_id + broker_id combination to prevent duplicates
*/

-- Create entity_brokers table
CREATE TABLE IF NOT EXISTS entity_brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  broker_id uuid REFERENCES brokers(id) ON DELETE CASCADE,
  relationship_type text DEFAULT 'Primary Broker',
  is_active boolean DEFAULT true,
  assigned_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_entity_broker UNIQUE(entity_id, broker_id)
);

-- Add check constraint for relationship_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'entity_brokers_relationship_type_check'
  ) THEN
    ALTER TABLE entity_brokers 
    ADD CONSTRAINT entity_brokers_relationship_type_check 
    CHECK (relationship_type IN ('Primary Broker', 'Secondary Broker', 'Custodian', 'Other'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE entity_brokers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read entity-broker relationships"
  ON entity_brokers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert entity-broker relationships"
  ON entity_brokers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update entity-broker relationships"
  ON entity_brokers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete entity-broker relationships"
  ON entity_brokers
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_entity_brokers_entity_id ON entity_brokers(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_brokers_broker_id ON entity_brokers(broker_id);
CREATE INDEX IF NOT EXISTS idx_entity_brokers_is_active ON entity_brokers(is_active);
