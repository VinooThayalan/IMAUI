/*
  # Add Dummy Data - Cash Balance Ledger, Buy/Sell Notes, Buy/Sell Approvals

  ## Summary
  Inserts realistic sample data for Cash Balance, Buy/Sell Notes, and
  Buy/Sell Approvals screens.

  ## New Records
  ### Cash Balance Ledger (12 records)
  - Running balance entries for each entity showing additions, deductions, and on-hold amounts

  ### Buy/Sell Notes (5 records)
  - Contract notes linked to approved transactions

  ### Buy/Sell Approvals (3 records)
  - Approval records for buy/sell notes with mixed statuses
*/

-- Insert Cash Balance Ledger entries
INSERT INTO cash_balance_ledger (id, type, description, code, amount, date, running_balance, on_hold_amount, entity_id, bank_id, created_by, notes)
VALUES
  ('ac000001-0000-0000-0000-000000000001', 'Addition', 'Opening Balance - Sunshine Holdings', 'OPEN-2025', 10000000.00, '2025-01-01', 10000000.00, 0, 'a1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'Admin', 'Initial cash balance'),
  ('ac000001-0000-0000-0000-000000000002', 'Deduction', 'BUY - JKH 5000 shares', 'TXN-D100001', 937888.00, '2026-01-15', 9062112.00, 0, 'a1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'System', 'Buy JKH at Rs. 185.50'),
  ('ac000001-0000-0000-0000-000000000003', 'Deduction', 'BUY - CTC 800 shares', 'TXN-D100006', 930304.00, '2026-02-15', 8131808.00, 0, 'a1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'System', 'Buy CTC at Rs. 1150.00'),
  ('ac000001-0000-0000-0000-000000000004', 'Addition', 'Opening Balance - Star Capital', 'OPEN-2025', 15000000.00, '2025-01-01', 15000000.00, 0, 'a1000001-0000-0000-0000-000000000002', 'b1000001-0000-0000-0000-000000000003', 'Admin', 'Initial cash balance'),
  ('ac000001-0000-0000-0000-000000000005', 'Addition', 'SELL - LOLC 3000 shares', 'TXN-D100002', 1260720.00, '2026-01-18', 16260720.00, 0, 'a1000001-0000-0000-0000-000000000002', 'b1000001-0000-0000-0000-000000000003', 'System', 'Sell LOLC at Rs. 425.00'),
  ('ac000001-0000-0000-0000-000000000006', 'Addition', 'SELL - NDB 2500 shares', 'TXN-D100007', 939978.00, '2026-02-20', 17200698.00, 0, 'a1000001-0000-0000-0000-000000000002', 'b1000001-0000-0000-0000-000000000003', 'System', 'Sell NDB at Rs. 380.25'),
  ('ac000001-0000-0000-0000-000000000007', 'Addition', 'Opening Balance - Rohan Perera', 'OPEN-2025', 3000000.00, '2025-01-01', 3000000.00, 0, 'a1000001-0000-0000-0000-000000000003', 'b1000001-0000-0000-0000-000000000004', 'Admin', 'Initial cash balance'),
  ('ac000001-0000-0000-0000-000000000008', 'Deduction', 'BUY - HNB 2000 shares', 'TXN-D100003', 497005.00, '2026-01-22', 2502995.00, 0, 'a1000001-0000-0000-0000-000000000003', 'b1000001-0000-0000-0000-000000000004', 'System', 'Buy HNB at Rs. 245.75'),
  ('ac000001-0000-0000-0000-000000000009', 'Addition', 'Opening Balance - Nisha Fernando', 'OPEN-2025', 5000000.00, '2025-01-01', 5000000.00, 0, 'a1000001-0000-0000-0000-000000000004', 'b1000001-0000-0000-0000-000000000005', 'Admin', 'Initial cash balance'),
  ('ac000001-0000-0000-0000-000000000010', 'Addition', 'SELL - Commercial Bank 1500 shares', 'TXN-D100004', 474624.00, '2026-02-05', 5474624.00, 0, 'a1000001-0000-0000-0000-000000000004', 'b1000001-0000-0000-0000-000000000005', 'System', 'Sell Commercial Bank at Rs. 320.00'),
  ('ac000001-0000-0000-0000-000000000011', 'Addition', 'Opening Balance - Lanka Wealth', 'OPEN-2025', 25000000.00, '2025-01-01', 25000000.00, 0, 'a1000001-0000-0000-0000-000000000005', 'b1000001-0000-0000-0000-000000000006', 'Admin', 'Initial cash balance'),
  ('ac000001-0000-0000-0000-000000000012', 'Deduction', 'BUY - Hemas 4000 shares', 'TXN-D100008', 881766.00, '2026-03-01', 24118234.00, 0, 'a1000001-0000-0000-0000-000000000005', 'b1000001-0000-0000-0000-000000000006', 'System', 'Buy Hemas at Rs. 218.00')
ON CONFLICT (id) DO NOTHING;

-- Insert Buy/Sell Notes
INSERT INTO buy_sell_notes (id, transaction_id, note_type, note_number, broker, broker_id, dealer_name, transaction_date, settlement_date, trade_date, contract_no, no_of_shares, price_avg, gross_amount, brokerage, sec, exchange, cds, gov_cess, clearing_fees, net_amount, foreign_brokerage)
VALUES
  ('ad000001-0000-0000-0000-000000000001', 'd1000001-0000-0000-0000-000000000001', 'Buy', 'CN-JKH-2026-001', 'John Keells Stock Brokers', 'e2876fd6-ca0f-4165-9904-a7f265377875', 'Pradeep Jayasuriya', '2026-01-15', '2026-01-17', '2026-01-15', 'CN-JKH-2026-001', 5000, 185.50, 927500.00, 10388.00, 1855.00, 742.00, 371.00, 1113.00, 556.50, 937888.00, 0),
  ('ad000001-0000-0000-0000-000000000002', 'd1000001-0000-0000-0000-000000000002', 'Sell', 'CN-CAP-2026-002', 'Capital Alliance Securities', '14167eaa-d176-493b-a75a-0e572a719273', 'Supun Alwis', '2026-01-18', '2026-01-20', '2026-01-18', 'CN-CAP-2026-002', 3000, 425.00, 1275000.00, 14280.00, 2550.00, 1020.00, 510.00, 1530.00, 765.00, 1260720.00, 0),
  ('ad000001-0000-0000-0000-000000000003', 'd1000001-0000-0000-0000-000000000003', 'Buy', 'CN-FCE-2026-003', 'First Capital Equities', '874e66a3-a152-4d63-818b-854bcdc86886', 'Tharaka Bandara', '2026-01-22', '2026-01-24', '2026-01-22', 'CN-FCE-2026-003', 2000, 245.75, 491500.00, 5505.00, 983.00, 393.20, 196.60, 589.80, 294.90, 497005.00, 0),
  ('ad000001-0000-0000-0000-000000000004', 'd1000001-0000-0000-0000-000000000006', 'Buy', 'CN-JKH-2026-004', 'John Keells Stock Brokers', 'e2876fd6-ca0f-4165-9904-a7f265377875', 'Pradeep Jayasuriya', '2026-02-15', '2026-02-17', '2026-02-15', 'CN-JKH-2026-004', 800, 1150.00, 920000.00, 10304.00, 1840.00, 736.00, 368.00, 1104.00, 552.00, 930304.00, 0),
  ('ad000001-0000-0000-0000-000000000005', 'd1000001-0000-0000-0000-000000000007', 'Sell', 'CN-CAP-2026-005', 'Capital Alliance Securities', '14167eaa-d176-493b-a75a-0e572a719273', 'Supun Alwis', '2026-02-20', '2026-02-22', '2026-02-20', 'CN-CAP-2026-005', 2500, 380.25, 950625.00, 10647.00, 1901.25, 760.50, 380.25, 1140.75, 570.38, 939978.00, 0)
ON CONFLICT (id) DO NOTHING;

-- Insert Buy/Sell Approvals
INSERT INTO buy_sell_approvals (id, buy_sell_note_id, status, submitted_by, submitted_date, reviewed_by, reviewed_date, remarks, priority)
VALUES
  ('ae000001-0000-0000-0000-000000000001', 'ad000001-0000-0000-0000-000000000001', 'Approved', 'Anura Wickramasinghe', '2026-01-15 11:00:00+05:30', 'Dilshan Silva', '2026-01-15 14:30:00+05:30', 'All figures verified and match. Approved for processing.', 'Medium'),
  ('ae000001-0000-0000-0000-000000000002', 'ad000001-0000-0000-0000-000000000002', 'Approved', 'Dilshan Rathnayake', '2026-01-18 15:00:00+05:30', 'Renuka Perera', '2026-01-18 17:00:00+05:30', 'Sell note verified. Brokerage rates confirmed.', 'High'),
  ('ae000001-0000-0000-0000-000000000003', 'ad000001-0000-0000-0000-000000000003', 'Pending', 'Rohan Perera', '2026-01-22 10:15:00+05:30', NULL, NULL, NULL, 'Low'),
  ('ae000001-0000-0000-0000-000000000004', 'ad000001-0000-0000-0000-000000000004', 'Rejected', 'Anura Wickramasinghe', '2026-02-15 16:00:00+05:30', 'Chamari Gunawardena', '2026-02-16 09:30:00+05:30', 'Brokerage rate discrepancy detected. Please re-verify with broker.', 'High'),
  ('ae000001-0000-0000-0000-000000000005', 'ad000001-0000-0000-0000-000000000005', 'Pending', 'Dilshan Rathnayake', '2026-02-20 10:00:00+05:30', NULL, NULL, NULL, 'Medium')
ON CONFLICT (id) DO NOTHING;
