/*
  # Add Sample Data

  1. Sample Data Additions
    - Add sample brokers
    - Add sample entity types
    - Add sample industry types
    - Add sample sector types
    - Add sample shares
    - Add sample brokerage fee types

  This migration provides realistic test data for the application.
*/

-- Insert sample brokers
INSERT INTO brokers (broker_id, broker_name)
SELECT 'BRK001', 'Capital Trust Securities'
WHERE NOT EXISTS (SELECT 1 FROM brokers WHERE broker_id = 'BRK001');

INSERT INTO brokers (broker_id, broker_name)
SELECT 'BRK002', 'Asia Securities Limited'
WHERE NOT EXISTS (SELECT 1 FROM brokers WHERE broker_id = 'BRK002');

INSERT INTO brokers (broker_id, broker_name)
SELECT 'BRK003', 'Ceylon Investment Brokers'
WHERE NOT EXISTS (SELECT 1 FROM brokers WHERE broker_id = 'BRK003');

INSERT INTO brokers (broker_id, broker_name)
SELECT 'BRK004', 'Lanka Stock Traders'
WHERE NOT EXISTS (SELECT 1 FROM brokers WHERE broker_id = 'BRK004');

INSERT INTO brokers (broker_id, broker_name)
SELECT 'BRK005', 'First Capital Equities'
WHERE NOT EXISTS (SELECT 1 FROM brokers WHERE broker_id = 'BRK005');

-- Insert sample entity types
INSERT INTO entity_types (name)
SELECT 'Individual'
WHERE NOT EXISTS (SELECT 1 FROM entity_types WHERE name = 'Individual');

INSERT INTO entity_types (name)
SELECT 'Company'
WHERE NOT EXISTS (SELECT 1 FROM entity_types WHERE name = 'Company');

INSERT INTO entity_types (name)
SELECT 'Trust'
WHERE NOT EXISTS (SELECT 1 FROM entity_types WHERE name = 'Trust');

INSERT INTO entity_types (name)
SELECT 'Partnership'
WHERE NOT EXISTS (SELECT 1 FROM entity_types WHERE name = 'Partnership');

-- Insert sample industry types
INSERT INTO industry_types (industry_name)
SELECT 'Banking & Finance'
WHERE NOT EXISTS (SELECT 1 FROM industry_types WHERE industry_name = 'Banking & Finance');

INSERT INTO industry_types (industry_name)
SELECT 'Manufacturing'
WHERE NOT EXISTS (SELECT 1 FROM industry_types WHERE industry_name = 'Manufacturing');

INSERT INTO industry_types (industry_name)
SELECT 'Consumer Goods'
WHERE NOT EXISTS (SELECT 1 FROM industry_types WHERE industry_name = 'Consumer Goods');

INSERT INTO industry_types (industry_name)
SELECT 'Technology'
WHERE NOT EXISTS (SELECT 1 FROM industry_types WHERE industry_name = 'Technology');

-- Insert sample sector types
INSERT INTO sector_types (sector_name)
SELECT 'Banking'
WHERE NOT EXISTS (SELECT 1 FROM sector_types WHERE sector_name = 'Banking');

INSERT INTO sector_types (sector_name)
SELECT 'Insurance'
WHERE NOT EXISTS (SELECT 1 FROM sector_types WHERE sector_name = 'Insurance');

INSERT INTO sector_types (sector_name)
SELECT 'Diversified Financials'
WHERE NOT EXISTS (SELECT 1 FROM sector_types WHERE sector_name = 'Diversified Financials');

INSERT INTO sector_types (sector_name)
SELECT 'Beverages Food & Tobacco'
WHERE NOT EXISTS (SELECT 1 FROM sector_types WHERE sector_name = 'Beverages Food & Tobacco');

INSERT INTO sector_types (sector_name)
SELECT 'Telecommunications'
WHERE NOT EXISTS (SELECT 1 FROM sector_types WHERE sector_name = 'Telecommunications');

-- Insert sample shares with sector references
DO $$
DECLARE
  banking_sector_id uuid;
  telecom_sector_id uuid;
  beverage_sector_id uuid;
  finance_sector_id uuid;
BEGIN
  -- Get sector IDs
  SELECT id INTO banking_sector_id FROM sector_types WHERE sector_name = 'Banking' LIMIT 1;
  SELECT id INTO telecom_sector_id FROM sector_types WHERE sector_name = 'Telecommunications' LIMIT 1;
  SELECT id INTO beverage_sector_id FROM sector_types WHERE sector_name = 'Beverages Food & Tobacco' LIMIT 1;
  SELECT id INTO finance_sector_id FROM sector_types WHERE sector_name = 'Diversified Financials' LIMIT 1;

  -- Insert sample shares
  IF NOT EXISTS (SELECT 1 FROM shares WHERE ticker = 'JKH.N0000') THEN
    INSERT INTO shares (ticker, share_name, gis_code, sector_id, currency) VALUES
      ('JKH.N0000', 'John Keells Holdings PLC', 'GIS001', finance_sector_id, 'LKR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shares WHERE ticker = 'COMB.N0000') THEN
    INSERT INTO shares (ticker, share_name, gis_code, sector_id, currency) VALUES
      ('COMB.N0000', 'Commercial Bank of Ceylon PLC', 'GIS002', banking_sector_id, 'LKR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shares WHERE ticker = 'SAMP.N0000') THEN
    INSERT INTO shares (ticker, share_name, gis_code, sector_id, currency) VALUES
      ('SAMP.N0000', 'Sampath Bank PLC', 'GIS003', banking_sector_id, 'LKR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shares WHERE ticker = 'HNB.N0000') THEN
    INSERT INTO shares (ticker, share_name, gis_code, sector_id, currency) VALUES
      ('HNB.N0000', 'Hatton National Bank PLC', 'GIS004', banking_sector_id, 'LKR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shares WHERE ticker = 'DIAL.N0000') THEN
    INSERT INTO shares (ticker, share_name, gis_code, sector_id, currency) VALUES
      ('DIAL.N0000', 'Dialog Axiata PLC', 'GIS006', telecom_sector_id, 'LKR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shares WHERE ticker = 'LION.N0000') THEN
    INSERT INTO shares (ticker, share_name, gis_code, sector_id, currency) VALUES
      ('LION.N0000', 'Lion Brewery (Ceylon) PLC', 'GIS007', beverage_sector_id, 'LKR');
  END IF;
END $$;

-- Insert sample brokerage fee types
INSERT INTO brokerage_fee_types (name, min_price, max_price, rate, description)
SELECT 'Tier 1 - Small Trades', 0, 100000, 0.70, 'For trades up to LKR 100,000'
WHERE NOT EXISTS (SELECT 1 FROM brokerage_fee_types WHERE name = 'Tier 1 - Small Trades');

INSERT INTO brokerage_fee_types (name, min_price, max_price, rate, description)
SELECT 'Tier 2 - Medium Trades', 100000.01, 500000, 0.50, 'For trades between LKR 100,000 and 500,000'
WHERE NOT EXISTS (SELECT 1 FROM brokerage_fee_types WHERE name = 'Tier 2 - Medium Trades');

INSERT INTO brokerage_fee_types (name, min_price, max_price, rate, description)
SELECT 'Tier 3 - Large Trades', 500000.01, 2000000, 0.40, 'For trades between LKR 500,000 and 2,000,000'
WHERE NOT EXISTS (SELECT 1 FROM brokerage_fee_types WHERE name = 'Tier 3 - Large Trades');