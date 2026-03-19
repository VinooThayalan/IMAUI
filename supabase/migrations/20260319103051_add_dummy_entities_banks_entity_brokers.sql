/*
  # Add Dummy Data - Entities, Banks, Entity Brokers

  ## Summary
  Inserts realistic sample data for screens that currently show no data.

  ## New Records
  ### Entities (5 records)
  - Sunshine Holdings Ltd (Corporate)
  - Star Capital Investments (Corporate)
  - Rohan Perera (Individual)
  - Nisha Fernando (Individual)
  - Lanka Wealth Management Ltd (Corporate)

  ### Banks (6 records)
  - Various bank accounts linked to entities with balances, facility limits

  ### Entity Brokers (5 records)
  - Broker/Custodian assignments for entities
*/

-- Insert Entities
INSERT INTO entities (id, entity_id, name, type, entity_type_id, tax_name, nic_company_id, key_contact_name, company_individual_address, contact_email_company_individual, contact_phone, contact_mobile, current_balance)
VALUES
  ('a1000001-0000-0000-0000-000000000001', 'ENT-001', 'Sunshine Holdings Ltd', 'Corporate', '9c9f2b7f-39aa-4aa5-8da6-f7a1e4efeb4f', 'Sunshine Holdings Ltd', 'PV00123456', 'Anura Wickramasinghe', 'No. 12, Galle Road, Colombo 03', 'anura@sunshinehold.lk', '+94112345678', '+94771234567', 8500000.00),
  ('a1000001-0000-0000-0000-000000000002', 'ENT-002', 'Star Capital Investments', 'Corporate', '9c9f2b7f-39aa-4aa5-8da6-f7a1e4efeb4f', 'Star Capital Investments (Pvt) Ltd', 'PV00789012', 'Dilshan Rathnayake', 'No. 45, Union Place, Colombo 02', 'dilshan@starcapital.lk', '+94112987654', '+94779876543', 12750000.00),
  ('a1000001-0000-0000-0000-000000000003', 'ENT-003', 'Rohan Perera', 'Individual', '43c91be9-f011-4d69-a87c-96688e54f436', 'Rohan Chaminda Perera', '912345678V', 'Rohan Perera', 'No. 7, Nawala Road, Rajagiriya', 'rohan.perera@gmail.com', NULL, '+94765432109', 2300000.00),
  ('a1000001-0000-0000-0000-000000000004', 'ENT-004', 'Nisha Fernando', 'Individual', '43c91be9-f011-4d69-a87c-96688e54f436', 'Nisha Priyanka Fernando', '887654321V', 'Nisha Fernando', 'No. 23, Flower Road, Colombo 07', 'nisha.fernando@yahoo.com', NULL, '+94774567890', 4100000.00),
  ('a1000001-0000-0000-0000-000000000005', 'ENT-005', 'Lanka Wealth Management Ltd', 'Corporate', '9c9f2b7f-39aa-4aa5-8da6-f7a1e4efeb4f', 'Lanka Wealth Management Ltd', 'PV00456789', 'Samanthi Jayawardena', 'Level 5, World Trade Center, Colombo 01', 'samanthi@lankawm.lk', '+94112600800', '+94712600800', 22000000.00)
ON CONFLICT (id) DO NOTHING;

-- Insert Banks
INSERT INTO banks (id, entity_id, name, account_number, branch, currency, balance, facility_limit, interest_rate, charges_per_transaction)
VALUES
  ('b1000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'Commercial Bank of Ceylon', '1001234567', 'Colombo Main', 'LKR', 5200000.00, 10000000.00, 12.50, 250.00),
  ('b1000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000001', 'Hatton National Bank', '2009876543', 'Galle Road', 'LKR', 3300000.00, 5000000.00, 13.00, 200.00),
  ('b1000001-0000-0000-0000-000000000003', 'a1000001-0000-0000-0000-000000000002', 'Sampath Bank', '3005551234', 'Union Place', 'LKR', 8750000.00, 15000000.00, 11.75, 300.00),
  ('b1000001-0000-0000-0000-000000000004', 'a1000001-0000-0000-0000-000000000003', 'Bank of Ceylon', '4001112233', 'Nawala', 'LKR', 1800000.00, 2000000.00, 14.00, 150.00),
  ('b1000001-0000-0000-0000-000000000005', 'a1000001-0000-0000-0000-000000000004', 'Nations Trust Bank', '5009988776', 'Flower Road', 'LKR', 3500000.00, 5000000.00, 12.00, 200.00),
  ('b1000001-0000-0000-0000-000000000006', 'a1000001-0000-0000-0000-000000000005', 'People''s Bank', '6007778899', 'WTC Branch', 'LKR', 18000000.00, 30000000.00, 11.00, 350.00)
ON CONFLICT (id) DO NOTHING;

-- Insert Entity Brokers
INSERT INTO entity_brokers (id, entity_id, broker_id, broker_name_id, relationship_type, is_active, assigned_date, broker_account_number, bank_id, currency)
VALUES
  ('c1000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'e2876fd6-ca0f-4165-9904-a7f265377875', 'e2876fd6-ca0f-4165-9904-a7f265377875', 'Broker', true, '2023-01-15', 'JKH-SH-001', 'b1000001-0000-0000-0000-000000000001', 'LKR'),
  ('c1000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000002', '14167eaa-d176-493b-a75a-0e572a719273', '14167eaa-d176-493b-a75a-0e572a719273', 'Broker', true, '2023-03-20', 'CAP-SC-002', 'b1000001-0000-0000-0000-000000000003', 'LKR'),
  ('c1000001-0000-0000-0000-000000000003', 'a1000001-0000-0000-0000-000000000003', '874e66a3-a152-4d63-818b-854bcdc86886', '874e66a3-a152-4d63-818b-854bcdc86886', 'Broker', true, '2023-06-10', 'FCE-RP-003', 'b1000001-0000-0000-0000-000000000004', 'LKR'),
  ('c1000001-0000-0000-0000-000000000004', 'a1000001-0000-0000-0000-000000000004', '1c3db1a6-5c08-49ca-8e9d-5b4afb23f0a7', '1c3db1a6-5c08-49ca-8e9d-5b4afb23f0a7', 'Broker', true, '2023-08-01', 'ACU-NF-004', 'b1000001-0000-0000-0000-000000000005', 'LKR'),
  ('c1000001-0000-0000-0000-000000000005', 'a1000001-0000-0000-0000-000000000005', 'bd068dd0-2964-4ed6-b33a-caf596513b9e', 'bd068dd0-2964-4ed6-b33a-caf596513b9e', 'Broker', true, '2022-11-05', 'NDB-LW-005', 'b1000001-0000-0000-0000-000000000006', 'LKR')
ON CONFLICT (id) DO NOTHING;
