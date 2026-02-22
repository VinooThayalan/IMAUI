/*
  # Simplify Entity-Broker Relationship Types
  
  This migration updates the entity_brokers table to use only "Broker" and "Custodian" types.
  
  1. Changes
    - Updates check constraint to allow only "Broker" and "Custodian"
    - Migrates existing "Primary Broker" and "Secondary Broker" to "Broker"
    - Keeps "Custodian" as is
    
  2. Data Migration
    - All "Primary Broker" records → "Broker"
    - All "Secondary Broker" records → "Broker"
    - "Custodian" records remain unchanged
*/

-- Drop the old constraint first
ALTER TABLE entity_brokers 
DROP CONSTRAINT IF EXISTS entity_brokers_relationship_type_check;

-- Update existing data
UPDATE entity_brokers 
SET relationship_type = 'Broker' 
WHERE relationship_type IN ('Primary Broker', 'Secondary Broker', 'Other');

-- Add new simplified constraint
ALTER TABLE entity_brokers 
ADD CONSTRAINT entity_brokers_relationship_type_check 
CHECK (relationship_type = ANY (ARRAY['Broker'::text, 'Custodian'::text]));