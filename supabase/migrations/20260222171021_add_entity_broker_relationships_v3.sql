/*
  # Add Entity-Broker Relationships
  
  This migration creates relationships between entities and brokers with account numbers.
  
  1. Entity-Broker Relationships
    - Links entities to brokers with account information
    - Includes Primary Broker, Secondary Broker, and Custodian relationship types
    - Adds CDS account numbers and broker account numbers
    
  Notes:
    - This enables the Broker Account ID dropdown in the transaction form
    - Each entity can have multiple broker relationships
    - Account numbers follow standard Sri Lankan format
*/

DO $$
DECLARE
  v_entity1_id uuid;
  v_entity2_id uuid;
  v_entity3_id uuid;
  v_entity4_id uuid;
  v_entity5_id uuid;
  v_entity6_id uuid;
  v_broker1_id uuid;
  v_broker2_id uuid;
  v_broker3_id uuid;
BEGIN
  -- Get entity IDs
  SELECT id INTO v_entity1_id FROM entities WHERE entity_id = 'E001' LIMIT 1;
  SELECT id INTO v_entity2_id FROM entities WHERE entity_id = 'E002' LIMIT 1;
  SELECT id INTO v_entity3_id FROM entities WHERE entity_id = 'E003' LIMIT 1;
  SELECT id INTO v_entity4_id FROM entities WHERE entity_id = 'E006' LIMIT 1;
  SELECT id INTO v_entity5_id FROM entities WHERE entity_id = 'E007' LIMIT 1;
  SELECT id INTO v_entity6_id FROM entities WHERE entity_id = 'E008' LIMIT 1;
  
  -- Get broker IDs
  SELECT id INTO v_broker1_id FROM brokers WHERE broker_id = 'BRK001' LIMIT 1;
  SELECT id INTO v_broker2_id FROM brokers WHERE broker_id = 'BRK002' LIMIT 1;
  SELECT id INTO v_broker3_id FROM brokers WHERE broker_id = 'BRK003' LIMIT 1;
  
  -- Only proceed if we have the required data
  IF v_entity1_id IS NOT NULL AND v_broker1_id IS NOT NULL THEN
    -- Add entity-broker relationships for Entity 1 (Fernando Family Trust)
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity1_id, v_broker1_id, 'Primary Broker',
      'BA-FER-12345', true, CURRENT_DATE - INTERVAL '180 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity1_id AND broker_id = v_broker1_id AND relationship_type = 'Primary Broker'
    );
    
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      custodian_account_number, broker_name_id, is_active, assigned_date
    )
    SELECT 
      v_entity1_id, v_broker2_id, 'Custodian',
      'CDS-FER-67890', v_broker1_id, true, CURRENT_DATE - INTERVAL '150 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity1_id AND broker_id = v_broker2_id AND relationship_type = 'Custodian'
    );
  END IF;
  
  IF v_entity2_id IS NOT NULL AND v_broker2_id IS NOT NULL THEN
    -- Add entity-broker relationships for Entity 2 (Perera Holdings)
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity2_id, v_broker2_id, 'Primary Broker',
      'BA-PER-54321', true, CURRENT_DATE - INTERVAL '200 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity2_id AND broker_id = v_broker2_id AND relationship_type = 'Primary Broker'
    );
    
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity2_id, v_broker3_id, 'Secondary Broker',
      'BA-PER-98765', true, CURRENT_DATE - INTERVAL '90 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity2_id AND broker_id = v_broker3_id AND relationship_type = 'Secondary Broker'
    );
  END IF;
  
  IF v_entity3_id IS NOT NULL AND v_broker1_id IS NOT NULL THEN
    -- Add entity-broker relationships for Entity 3 (Silva Investments)
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity3_id, v_broker1_id, 'Primary Broker',
      'BA-SIL-11111', true, CURRENT_DATE - INTERVAL '120 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity3_id AND broker_id = v_broker1_id AND relationship_type = 'Primary Broker'
    );
    
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      custodian_account_number, broker_name_id, is_active, assigned_date
    )
    SELECT 
      v_entity3_id, v_broker3_id, 'Custodian',
      'CDS-SIL-22222', v_broker2_id, true, CURRENT_DATE - INTERVAL '100 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity3_id AND broker_id = v_broker3_id AND relationship_type = 'Custodian'
    );
  END IF;
  
  IF v_entity4_id IS NOT NULL AND v_broker1_id IS NOT NULL THEN
    -- Add entity-broker relationships for Entity 4 (De Silva Ventures)
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity4_id, v_broker1_id, 'Primary Broker',
      'BA-DES-33333', true, CURRENT_DATE - INTERVAL '60 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity4_id AND broker_id = v_broker1_id AND relationship_type = 'Primary Broker'
    );
    
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity4_id, v_broker2_id, 'Secondary Broker',
      'BA-DES-77777', true, CURRENT_DATE - INTERVAL '30 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity4_id AND broker_id = v_broker2_id AND relationship_type = 'Secondary Broker'
    );
  END IF;
  
  IF v_entity5_id IS NOT NULL AND v_broker2_id IS NOT NULL THEN
    -- Add entity-broker relationships for Entity 5 (Rajapaksa Enterprises)
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity5_id, v_broker2_id, 'Primary Broker',
      'BA-RAJ-44444', true, CURRENT_DATE - INTERVAL '75 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity5_id AND broker_id = v_broker2_id AND relationship_type = 'Primary Broker'
    );
    
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      custodian_account_number, broker_name_id, is_active, assigned_date
    )
    SELECT 
      v_entity5_id, v_broker1_id, 'Custodian',
      'CDS-RAJ-55555', v_broker3_id, true, CURRENT_DATE - INTERVAL '50 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity5_id AND broker_id = v_broker1_id AND relationship_type = 'Custodian'
    );
  END IF;
  
  IF v_entity6_id IS NOT NULL AND v_broker3_id IS NOT NULL THEN
    -- Add entity-broker relationships for Entity 6 (Gunasekara Holdings)
    INSERT INTO entity_brokers (
      entity_id, broker_id, relationship_type, 
      broker_account_number, is_active, assigned_date
    )
    SELECT 
      v_entity6_id, v_broker3_id, 'Primary Broker',
      'BA-GUN-66666', true, CURRENT_DATE - INTERVAL '45 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_brokers 
      WHERE entity_id = v_entity6_id AND broker_id = v_broker3_id AND relationship_type = 'Primary Broker'
    );
  END IF;

END $$;