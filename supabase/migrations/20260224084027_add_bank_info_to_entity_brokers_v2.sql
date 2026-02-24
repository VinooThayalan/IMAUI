/*
  # Add Bank Information to Entity-Broker Relationships
  
  This migration adds bank information to entity_broker relationships.
  
  1. Updates
    - Links entity_brokers to banks
    - Adds bank account numbers
    - Adds facility limits
    
  Notes:
    - Each broker account relationship now has associated banking details
    - Facility limits represent credit/overdraft facilities available
    - Bank account numbers are unique per entity-broker relationship
*/

DO $$
DECLARE
  v_bank1_id uuid;
  v_bank2_id uuid;
  v_bank3_id uuid;
BEGIN
  -- Get bank IDs by name
  SELECT id INTO v_bank1_id FROM banks WHERE name = 'Commercial Bank' LIMIT 1;
  SELECT id INTO v_bank2_id FROM banks WHERE name = 'Sampath Bank' LIMIT 1;
  SELECT id INTO v_bank3_id FROM banks WHERE name = 'HNB' LIMIT 1;
  
  -- Update Fernando Family Trust - Broker relationship
  UPDATE entity_brokers
  SET 
    bank_id = v_bank1_id,
    bank_account_number = '100123456789',
    facility_limit = 5000000.00
  WHERE broker_account_number = 'BA-FER-12345';
  
  -- Update Fernando Family Trust - Custodian relationship
  UPDATE entity_brokers
  SET 
    bank_id = v_bank1_id,
    bank_account_number = '100123456790',
    facility_limit = 3000000.00
  WHERE custodian_account_number = 'CDS-FER-67890';
  
  -- Update Perera Holdings - Primary Broker
  UPDATE entity_brokers
  SET 
    bank_id = v_bank2_id,
    bank_account_number = '200234567890',
    facility_limit = 8000000.00
  WHERE broker_account_number = 'BA-PER-54321';
  
  -- Update Perera Holdings - Secondary Broker
  UPDATE entity_brokers
  SET 
    bank_id = v_bank3_id,
    bank_account_number = '300345678901',
    facility_limit = 4000000.00
  WHERE broker_account_number = 'BA-PER-98765';
  
  -- Update Silva Investment Group - Broker
  UPDATE entity_brokers
  SET 
    bank_id = v_bank1_id,
    bank_account_number = '100456789012',
    facility_limit = 6000000.00
  WHERE broker_account_number = 'BA-SIL-11111';
  
  -- Update Silva Investment Group - Custodian
  UPDATE entity_brokers
  SET 
    bank_id = v_bank2_id,
    bank_account_number = '200567890123',
    facility_limit = 3500000.00
  WHERE custodian_account_number = 'CDS-SIL-22222';
  
  -- Update De Silva Ventures - Primary Broker
  UPDATE entity_brokers
  SET 
    bank_id = v_bank1_id,
    bank_account_number = '100678901234',
    facility_limit = 4500000.00
  WHERE broker_account_number = 'BA-DES-33333';
  
  -- Update De Silva Ventures - Secondary Broker
  UPDATE entity_brokers
  SET 
    bank_id = v_bank2_id,
    bank_account_number = '200789012345',
    facility_limit = 2500000.00
  WHERE broker_account_number = 'BA-DES-77777';
  
  -- Update Rajapaksa Enterprises - Broker
  UPDATE entity_brokers
  SET 
    bank_id = v_bank3_id,
    bank_account_number = '300890123456',
    facility_limit = 7000000.00
  WHERE broker_account_number = 'BA-RAJ-44444';
  
  -- Update Rajapaksa Enterprises - Custodian
  UPDATE entity_brokers
  SET 
    bank_id = v_bank3_id,
    bank_account_number = '300901234567',
    facility_limit = 3500000.00
  WHERE custodian_account_number = 'CDS-RAJ-55555';
  
  -- Update Gunasekara Holdings - Broker
  UPDATE entity_brokers
  SET 
    bank_id = v_bank2_id,
    bank_account_number = '200012345678',
    facility_limit = 5500000.00
  WHERE broker_account_number = 'BA-GUN-66666';

END $$;