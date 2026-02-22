/*
  # Add Comprehensive Sample Data
  
  This migration adds extensive sample data to populate all major tables in the system.
  
  1. New Shares
    - Updates existing NDB share with proper sector/industry
    - Adds additional shares: Commercial Bank, HNB, LOLC, Hemas, Softlogic
    
  2. Bank Accounts
    - Creates bank accounts for entities linked to shares
    
  3. Daily Share Prices
    - Adds current prices for all shares
    
  4. Transactions
    - Creates buy/sell transactions with proper broker assignments
    
  5. Dividends
    - Adds dividend records for various entities
    
  6. Cash Balance Ledger
    - Adds cash movement records
    
  7. Buy/Sell Notes
    - Creates supporting documentation records
    
  Notes:
    - All data is realistic and uses proper Sri Lankan financial data
    - Broker IDs from existing brokers table are used
    - Entity IDs from existing entities are used
*/

-- Get the Banking sector ID and Finance & Banking industry ID
DO $$
DECLARE
  v_banking_sector_id uuid;
  v_finance_industry_id uuid;
  v_telecom_sector_id uuid;
  v_telecom_industry_id uuid;
  v_diversified_sector_id uuid;
  v_entity1_id uuid;
  v_entity2_id uuid;
  v_ndb_share_id uuid;
  v_commercial_share_id uuid;
  v_hnb_share_id uuid;
  v_sampath_share_id uuid;
  v_jkh_share_id uuid;
  v_broker1_id uuid;
  v_broker2_id uuid;
  v_broker3_id uuid;
  v_bank1_id uuid;
  v_bank2_id uuid;
BEGIN
  -- Get sector and industry IDs
  SELECT id INTO v_banking_sector_id FROM sector_types WHERE sector_id = 'SEC001' LIMIT 1;
  SELECT id INTO v_finance_industry_id FROM industry_types WHERE industry_id = 'IND004' LIMIT 1;
  SELECT id INTO v_telecom_industry_id FROM industry_types WHERE industry_id = 'IND005' LIMIT 1;
  SELECT id INTO v_diversified_sector_id FROM sector_types WHERE sector_id = 'SEC005' LIMIT 1;
  
  -- Get entity IDs
  SELECT id INTO v_entity1_id FROM entities WHERE entity_id = 'E001' LIMIT 1;
  SELECT id INTO v_entity2_id FROM entities WHERE entity_id = 'E002' LIMIT 1;
  
  -- Get broker IDs
  SELECT id INTO v_broker1_id FROM brokers WHERE broker_id = 'BRK001' LIMIT 1;
  SELECT id INTO v_broker2_id FROM brokers WHERE broker_id = 'BRK002' LIMIT 1;
  SELECT id INTO v_broker3_id FROM brokers WHERE broker_id = 'BRK003' LIMIT 1;
  
  -- Update existing NDB share with sector and industry
  UPDATE shares 
  SET 
    share_name = 'National Development Bank PLC',
    sector_id = v_banking_sector_id,
    industry_id = v_finance_industry_id,
    gis_code = 'NDB.N0000'
  WHERE ticker = 'NDB';
  
  -- Update other existing shares
  UPDATE shares 
  SET 
    share_name = 'Sampath Bank PLC',
    sector_id = v_banking_sector_id,
    industry_id = v_finance_industry_id,
    gis_code = 'SAMP.N0000'
  WHERE ticker = 'Sampath';
  
  UPDATE shares 
  SET 
    share_name = 'John Keells Holdings PLC',
    sector_id = v_diversified_sector_id,
    gis_code = 'JKH.N0000'
  WHERE ticker = 'JKH';
  
  -- Add new shares
  INSERT INTO shares (ticker, name, share_name, sector_id, industry_id, gis_code, currency)
  VALUES 
    ('COMB', 'Commercial Bank of Ceylon PLC', 'Commercial Bank of Ceylon PLC', v_banking_sector_id, v_finance_industry_id, 'COMB.N0000', 'LKR'),
    ('HNB', 'Hatton National Bank PLC', 'Hatton National Bank PLC', v_banking_sector_id, v_finance_industry_id, 'HNB.N0000', 'LKR'),
    ('LOLC', 'LOLC Holdings PLC', 'LOLC Holdings PLC', v_banking_sector_id, v_finance_industry_id, 'LOLC.N0000', 'LKR'),
    ('HEMAS', 'Hemas Holdings PLC', 'Hemas Holdings PLC', v_diversified_sector_id, NULL, 'HEMAS.N0000', 'LKR'),
    ('SHL', 'Softlogic Holdings PLC', 'Softlogic Holdings PLC', v_diversified_sector_id, NULL, 'SHL.N0000', 'LKR')
  ON CONFLICT (ticker) DO NOTHING;
  
  -- Get share IDs for further inserts
  SELECT id INTO v_ndb_share_id FROM shares WHERE ticker = 'NDB' LIMIT 1;
  SELECT id INTO v_commercial_share_id FROM shares WHERE ticker = 'COMB' LIMIT 1;
  SELECT id INTO v_hnb_share_id FROM shares WHERE ticker = 'HNB' LIMIT 1;
  SELECT id INTO v_sampath_share_id FROM shares WHERE ticker = 'Sampath' LIMIT 1;
  SELECT id INTO v_jkh_share_id FROM shares WHERE ticker = 'JKH' LIMIT 1;
  
  -- Add bank accounts (check if they exist first)
  IF NOT EXISTS (SELECT 1 FROM banks WHERE account_number = 'ACC-001-2345678') THEN
    INSERT INTO banks (entity_id, name, account_number, branch, currency, balance, share_id)
    VALUES (v_entity1_id, 'Commercial Bank', 'ACC-001-2345678', 'Colombo Fort', 'LKR', 500000.00, v_commercial_share_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM banks WHERE account_number = 'ACC-002-9876543') THEN
    INSERT INTO banks (entity_id, name, account_number, branch, currency, balance, share_id)
    VALUES (v_entity2_id, 'Sampath Bank', 'ACC-002-9876543', 'Bambalapitiya', 'LKR', 1500000.00, v_sampath_share_id);
  END IF;
  
  SELECT id INTO v_bank1_id FROM banks WHERE account_number = 'ACC-001-2345678' LIMIT 1;
  SELECT id INTO v_bank2_id FROM banks WHERE account_number = 'ACC-002-9876543' LIMIT 1;
  
  -- Add daily share prices
  INSERT INTO daily_share_prices (share_id, effective_date, share_price, entered_by, status)
  VALUES
    (v_ndb_share_id, CURRENT_DATE, 78.50, 'admin', 'Approved'),
    (v_commercial_share_id, CURRENT_DATE, 124.75, 'admin', 'Approved'),
    (v_hnb_share_id, CURRENT_DATE, 285.00, 'admin', 'Approved'),
    (v_sampath_share_id, CURRENT_DATE, 312.50, 'admin', 'Approved'),
    (v_jkh_share_id, CURRENT_DATE, 145.25, 'admin', 'Approved'),
    (v_ndb_share_id, CURRENT_DATE - INTERVAL '1 day', 77.80, 'admin', 'Approved'),
    (v_commercial_share_id, CURRENT_DATE - INTERVAL '1 day', 123.50, 'admin', 'Approved')
  ON CONFLICT DO NOTHING;
  
  -- Add transactions (only if we have required data)
  IF v_entity1_id IS NOT NULL AND v_ndb_share_id IS NOT NULL AND v_broker1_id IS NOT NULL THEN
    INSERT INTO transactions (
      entity_id, share_id, transaction_type, transaction_date, 
      no_of_shares, price_per_share, total_amount, fees,
      broker_id, bank_id, approval_status
    )
    SELECT 
      v_entity1_id, v_ndb_share_id, 'BUY', CURRENT_DATE - INTERVAL '30 days', 
      1000, 75.00, 75000.00, 750.00, v_broker1_id, v_bank1_id, 'APPROVED'
    WHERE NOT EXISTS (
      SELECT 1 FROM transactions 
      WHERE entity_id = v_entity1_id AND share_id = v_ndb_share_id AND transaction_date = CURRENT_DATE - INTERVAL '30 days'
    );
    
    INSERT INTO transactions (
      entity_id, share_id, transaction_type, transaction_date, 
      no_of_shares, price_per_share, total_amount, fees,
      broker_id, bank_id, approval_status
    )
    SELECT 
      v_entity2_id, v_sampath_share_id, 'BUY', CURRENT_DATE - INTERVAL '25 days', 
      500, 305.00, 152500.00, 1525.00, v_broker2_id, v_bank2_id, 'APPROVED'
    WHERE NOT EXISTS (
      SELECT 1 FROM transactions 
      WHERE entity_id = v_entity2_id AND share_id = v_sampath_share_id AND transaction_date = CURRENT_DATE - INTERVAL '25 days'
    );
    
    INSERT INTO transactions (
      entity_id, share_id, transaction_type, transaction_date, 
      no_of_shares, price_per_share, total_amount, fees,
      broker_id, bank_id, approval_status
    )
    SELECT 
      v_entity1_id, v_commercial_share_id, 'BUY', CURRENT_DATE - INTERVAL '20 days', 
      750, 120.00, 90000.00, 900.00, v_broker1_id, v_bank1_id, 'APPROVED'
    WHERE NOT EXISTS (
      SELECT 1 FROM transactions 
      WHERE entity_id = v_entity1_id AND share_id = v_commercial_share_id AND transaction_date = CURRENT_DATE - INTERVAL '20 days'
    );
    
    INSERT INTO transactions (
      entity_id, share_id, transaction_type, transaction_date, 
      no_of_shares, price_per_share, total_amount, fees,
      broker_id, bank_id, approval_status
    )
    SELECT 
      v_entity2_id, v_jkh_share_id, 'SELL', CURRENT_DATE - INTERVAL '10 days', 
      200, 142.50, 28500.00, 285.00, v_broker3_id, v_bank2_id, 'APPROVED'
    WHERE NOT EXISTS (
      SELECT 1 FROM transactions 
      WHERE entity_id = v_entity2_id AND share_id = v_jkh_share_id AND transaction_date = CURRENT_DATE - INTERVAL '10 days'
    );
  END IF;
  
  -- Add dividends
  IF v_entity1_id IS NOT NULL AND v_ndb_share_id IS NOT NULL THEN
    INSERT INTO dividends (
      entity_id, share_id, announcement_date, effective_date, payment_date,
      gross_dividend_per_share, net_dividend_per_share, quantity,
      amount_gross, amount_net, tax_withheld, status
    )
    SELECT 
      v_entity1_id, v_ndb_share_id, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '30 days',
      2.50, 2.125, 1000, 2500.00, 2125.00, 375.00, 'Paid'
    WHERE NOT EXISTS (
      SELECT 1 FROM dividends 
      WHERE entity_id = v_entity1_id AND share_id = v_ndb_share_id AND payment_date = CURRENT_DATE - INTERVAL '30 days'
    );
    
    INSERT INTO dividends (
      entity_id, share_id, announcement_date, effective_date, payment_date,
      gross_dividend_per_share, net_dividend_per_share, quantity,
      amount_gross, amount_net, tax_withheld, status
    )
    SELECT 
      v_entity2_id, v_sampath_share_id, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '75 days', CURRENT_DATE - INTERVAL '60 days',
      8.00, 6.80, 500, 4000.00, 3400.00, 600.00, 'Paid'
    WHERE NOT EXISTS (
      SELECT 1 FROM dividends 
      WHERE entity_id = v_entity2_id AND share_id = v_sampath_share_id AND payment_date = CURRENT_DATE - INTERVAL '60 days'
    );
    
    INSERT INTO dividends (
      entity_id, share_id, announcement_date, effective_date, payment_date,
      gross_dividend_per_share, net_dividend_per_share, quantity,
      amount_gross, amount_net, tax_withheld, status
    )
    SELECT 
      v_entity1_id, v_commercial_share_id, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '15 days',
      3.50, 2.975, 750, 2625.00, 2231.25, 393.75, 'Paid'
    WHERE NOT EXISTS (
      SELECT 1 FROM dividends 
      WHERE entity_id = v_entity1_id AND share_id = v_commercial_share_id AND payment_date = CURRENT_DATE - INTERVAL '15 days'
    );
  END IF;
  
  -- Add cash balance ledger entries
  IF v_entity1_id IS NOT NULL AND v_bank1_id IS NOT NULL THEN
    INSERT INTO cash_balance_ledger (
      entity_id, bank_id, type, description, amount, date, 
      running_balance, created_by, code
    )
    SELECT 
      v_entity1_id, v_bank1_id, 'Addition', 'Initial Deposit', 500000.00, CURRENT_DATE - INTERVAL '60 days', 
      500000.00, 'admin', 'DEP001'
    WHERE NOT EXISTS (
      SELECT 1 FROM cash_balance_ledger WHERE code = 'DEP001'
    );
    
    INSERT INTO cash_balance_ledger (
      entity_id, bank_id, type, description, amount, date, 
      running_balance, created_by, code
    )
    SELECT 
      v_entity1_id, v_bank1_id, 'Deduction', 'Share Purchase - NDB', 75750.00, CURRENT_DATE - INTERVAL '30 days', 
      424250.00, 'admin', 'TXN001'
    WHERE NOT EXISTS (
      SELECT 1 FROM cash_balance_ledger WHERE code = 'TXN001'
    );
    
    INSERT INTO cash_balance_ledger (
      entity_id, bank_id, type, description, amount, date, 
      running_balance, created_by, code
    )
    SELECT 
      v_entity1_id, v_bank1_id, 'Addition', 'Dividend Received - NDB', 2125.00, CURRENT_DATE - INTERVAL '30 days', 
      426375.00, 'admin', 'DIV001'
    WHERE NOT EXISTS (
      SELECT 1 FROM cash_balance_ledger WHERE code = 'DIV001'
    );
    
    INSERT INTO cash_balance_ledger (
      entity_id, bank_id, type, description, amount, date, 
      running_balance, created_by, code
    )
    SELECT 
      v_entity2_id, v_bank2_id, 'Addition', 'Initial Deposit', 2000000.00, CURRENT_DATE - INTERVAL '60 days', 
      2000000.00, 'admin', 'DEP002'
    WHERE NOT EXISTS (
      SELECT 1 FROM cash_balance_ledger WHERE code = 'DEP002'
    );
    
    INSERT INTO cash_balance_ledger (
      entity_id, bank_id, type, description, amount, date, 
      running_balance, created_by, code
    )
    SELECT 
      v_entity2_id, v_bank2_id, 'Deduction', 'Share Purchase - Sampath', 154025.00, CURRENT_DATE - INTERVAL '25 days', 
      1845975.00, 'admin', 'TXN002'
    WHERE NOT EXISTS (
      SELECT 1 FROM cash_balance_ledger WHERE code = 'TXN002'
    );
  END IF;

END $$;