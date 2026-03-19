/*
  # Add Dummy Data - Dividends and Scrip Entries

  ## Summary
  Inserts realistic sample data for Dividends, Rights Issues, Share Buybacks,
  and Amalgamations screens.

  ## New Records
  ### Dividends (6 records)
  - Mix of Paid, Pending, and Processing statuses for different entities and shares

  ### Scrip Entries - Rights Issues (3 records)
  ### Scrip Entries - Share Buybacks (2 records)
  ### Scrip Entries - Amalgamations (2 records)
*/

-- Insert Dividends
INSERT INTO dividends (id, entity_id, share_id, quantity, gross_dividend_per_share, net_dividend_per_share, tax_withheld, amount_gross, amount_net, announcement_date, effective_date, payment_date, payment_method, cds_account, notes, status, currency)
VALUES
  ('aa000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'c0d24b81-aff9-4d60-a623-5af58cf83af0', 8000, 4.50, 3.83, 0.68, 36000.00, 30600.00, '2025-11-15', '2025-12-01', '2026-01-10', 'Direct Deposit', '1001234567-CDS', 'JKH interim dividend FY2025/26', 'Paid', 'LKR'),
  ('aa000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000001', 'dc21f767-fbe2-4626-a1f0-b6d4ea3b762b', 1200, 55.00, 46.75, 8.25, 66000.00, 56100.00, '2025-10-20', '2025-11-05', '2025-12-15', 'Transfer-CEFT', '1001234567-CDS', 'CTC final dividend FY2024/25', 'Paid', 'LKR'),
  ('aa000001-0000-0000-0000-000000000003', 'a1000001-0000-0000-0000-000000000002', '8eeda130-ad7c-4c1d-9560-52d792cdd0ba', 5000, 12.00, 10.20, 1.80, 60000.00, 51000.00, '2026-01-08', '2026-02-01', '2026-03-15', 'Direct Deposit', '2009876543-CDS', 'LOLC interim dividend', 'Processing', 'LKR'),
  ('aa000001-0000-0000-0000-000000000004', 'a1000001-0000-0000-0000-000000000003', '04cd72b6-8840-4d04-80be-0148b0d57fa2', 3000, 8.00, 6.80, 1.20, 24000.00, 20400.00, '2026-02-10', '2026-03-01', '2026-04-15', 'Cheque', NULL, 'HNB final dividend', 'Pending', 'LKR'),
  ('aa000001-0000-0000-0000-000000000005', 'a1000001-0000-0000-0000-000000000004', 'e445cc80-fb61-46ad-95d0-4ddb2fa60593', 2500, 6.50, 5.53, 0.98, 16250.00, 13813.00, '2025-12-05', '2026-01-10', '2026-02-20', 'Direct Deposit', '5009988776-CDS', 'Commercial Bank interim dividend', 'Paid', 'LKR'),
  ('aa000001-0000-0000-0000-000000000006', 'a1000001-0000-0000-0000-000000000005', 'fda8ef55-bacc-478c-a9be-4ba17e244108', 6000, 3.25, 2.76, 0.49, 19500.00, 16575.00, '2026-02-25', '2026-03-20', '2026-04-30', 'Transfer-CEFT', '6007778899-CDS', 'Hemas Holdings dividend', 'Pending', 'LKR')
ON CONFLICT (id) DO NOTHING;

-- Insert Scrip Entries - Rights Issues
INSERT INTO scrip_entries (id, entity_id, share_id, entry_date, status, no_of_shares, transaction_type, broker_id, cds_account_id, bank_id, announcement_date, allotment_date, rights_ratio, rights_issue_price, shares_at_announcement, allotted_shares, additional_requested, total_amount, notes)
VALUES
  ('ab000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'c0d24b81-aff9-4d60-a623-5af58cf83af0', '2025-09-15', 'ACTIVE', 2500, 'Rights Issue', 'e2876fd6-ca0f-4165-9904-a7f265377875', 'JKH-SH-001-CDS', 'b1000001-0000-0000-0000-000000000001', '2025-08-20', '2025-10-01', '1:5', 165.00, 12500, 2500, 'None', 412500.00, 'JKH rights issue at Rs. 165 per share'),
  ('ab000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000002', '8eeda130-ad7c-4c1d-9560-52d792cdd0ba', '2025-11-10', 'ACTIVE', 3000, 'Rights Issue', '14167eaa-d176-493b-a75a-0e572a719273', 'CAP-SC-002-CDS', 'b1000001-0000-0000-0000-000000000003', '2025-10-15', '2025-12-05', '1:4', 380.00, 12000, 3000, '500', 1330000.00, 'LOLC rights issue - applied for additional 500 shares'),
  ('ab000001-0000-0000-0000-000000000003', 'a1000001-0000-0000-0000-000000000005', 'fda8ef55-bacc-478c-a9be-4ba17e244108', '2026-01-20', 'ACTIVE', 1600, 'Rights Issue', 'bd068dd0-2964-4ed6-b33a-caf596513b9e', 'NDB-LW-005-CDS', 'b1000001-0000-0000-0000-000000000006', '2025-12-28', '2026-02-15', '2:10', 200.00, 8000, 1600, 'None', 320000.00, 'Hemas rights issue at discounted price')
ON CONFLICT (id) DO NOTHING;

-- Insert Scrip Entries - Share Buybacks
INSERT INTO scrip_entries (id, entity_id, share_id, entry_date, status, no_of_shares, transaction_type, broker_id, bank_id, announcement_date, buyback_date, buyback_ratio, shares_at_buyback, shares_accepted, additional_shares, buyback_rate, total_amount, notes)
VALUES
  ('ab000001-0000-0000-0000-000000000004', 'a1000001-0000-0000-0000-000000000001', 'dc21f767-fbe2-4626-a1f0-b6d4ea3b762b', '2025-07-10', 'ACTIVE', 500, 'Share Buyback', 'e2876fd6-ca0f-4165-9904-a7f265377875', 'b1000001-0000-0000-0000-000000000001', '2025-06-15', '2025-08-01', '1:20', 10000, '500', 'None', 1200.00, 600000.00, 'CTC buyback at Rs. 1200 per share'),
  ('ab000001-0000-0000-0000-000000000005', 'a1000001-0000-0000-0000-000000000002', '95aa91f1-0a3e-44d6-8ea8-6b85ef12d3f6', '2025-10-05', 'ACTIVE', 800, 'Share Buyback', '14167eaa-d176-493b-a75a-0e572a719273', 'b1000001-0000-0000-0000-000000000003', '2025-09-10', '2025-11-01', '1:15', 12000, '800', 'None', 395.00, 316000.00, 'NDB share buyback program')
ON CONFLICT (id) DO NOTHING;

-- Insert Scrip Entries - Amalgamations
INSERT INTO scrip_entries (id, entity_id, share_id, entry_date, status, no_of_shares, transaction_type, announcement_date, effective_date, amalgamation_date, shares_at_effective_date, amalgamation_ratio, new_total_shares, share_decrease, new_price_per_share, notes)
VALUES
  ('ab000001-0000-0000-0000-000000000006', 'a1000001-0000-0000-0000-000000000001', 'e490a272-820e-4533-a9c5-93aefd201229', '2025-05-20', 'ACTIVE', 15000, 'Amalgamation', '2025-04-10', '2025-06-01', '2025-06-01', 15000, '3:1', 5000, 10000, 37.50, 'Dialog share consolidation - 3 shares to 1'),
  ('ab000001-0000-0000-0000-000000000007', 'a1000001-0000-0000-0000-000000000005', '04cd72b6-8840-4d04-80be-0148b0d57fa2', '2025-08-15', 'ACTIVE', 6000, 'Amalgamation', '2025-07-20', '2025-09-01', '2025-09-01', 6000, '2:1', 3000, 3000, 495.00, 'HNB share consolidation - 2 shares to 1')
ON CONFLICT (id) DO NOTHING;
