/*
  # Add Dummy Data - Transactions and Transaction Requests

  ## Summary
  Inserts realistic sample transaction data including approved BUY/SELL/IPO transactions
  and pending transaction requests for the approval workflow screens.

  ## New Records
  ### Transactions (8 records)
  - Mix of BUY, SELL, IPO transactions with APPROVED status
  - Linked to entities, shares, brokers, banks

  ### Transaction Requests (6 records)
  - Pending, Approved, and Rejected requests for the approval workflow

  ### Transaction Approvals (2 records)
  - Approval records for approved transaction requests
*/

-- Insert Transactions (APPROVED)
INSERT INTO transactions (id, entity_id, share_id, transaction_type, transaction_date, no_of_shares, price_per_share, total_amount, fees, broker_id, bank_id, order_type, brokerage_fee_type_id, brokerage_fee_rate, total_amount_gross, approval_status, submitted_by, approved_by, approval_date)
VALUES
  ('d1000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'c0d24b81-aff9-4d60-a623-5af58cf83af0', 'BUY', '2026-01-15', 5000, 185.50, 927500.00, 10388.00, 'e2876fd6-ca0f-4165-9904-a7f265377875', 'b1000001-0000-0000-0000-000000000001', 'MARKET', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 937888.00, 'APPROVED', 'Anura Wickramasinghe', 'Dilshan Silva', '2026-01-15 10:30:00+05:30'),
  ('d1000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000002', '8eeda130-ad7c-4c1d-9560-52d792cdd0ba', 'SELL', '2026-01-18', 3000, 425.00, 1275000.00, 14280.00, '14167eaa-d176-493b-a75a-0e572a719273', 'b1000001-0000-0000-0000-000000000003', 'MARKET', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 1260720.00, 'APPROVED', 'Dilshan Rathnayake', 'Renuka Perera', '2026-01-18 14:15:00+05:30'),
  ('d1000001-0000-0000-0000-000000000003', 'a1000001-0000-0000-0000-000000000003', '04cd72b6-8840-4d04-80be-0148b0d57fa2', 'BUY', '2026-01-22', 2000, 245.75, 491500.00, 5505.00, '874e66a3-a152-4d63-818b-854bcdc86886', 'b1000001-0000-0000-0000-000000000004', 'LIMIT', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 497005.00, 'APPROVED', 'Rohan Perera', 'Chamari Gunawardena', '2026-01-22 09:45:00+05:30'),
  ('d1000001-0000-0000-0000-000000000004', 'a1000001-0000-0000-0000-000000000004', 'e445cc80-fb61-46ad-95d0-4ddb2fa60593', 'SELL', '2026-02-05', 1500, 320.00, 480000.00, 5376.00, '1c3db1a6-5c08-49ca-8e9d-5b4afb23f0a7', 'b1000001-0000-0000-0000-000000000005', 'MARKET', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 474624.00, 'APPROVED', 'Nisha Fernando', 'Renuka Perera', '2026-02-05 11:20:00+05:30'),
  ('d1000001-0000-0000-0000-000000000005', 'a1000001-0000-0000-0000-000000000005', 'e490a272-820e-4533-a9c5-93aefd201229', 'IPO', '2026-02-10', 10000, 12.50, 125000.00, 1400.00, 'bd068dd0-2964-4ed6-b33a-caf596513b9e', 'b1000001-0000-0000-0000-000000000006', 'MARKET', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 126400.00, 'APPROVED', 'Samanthi Jayawardena', 'Dilshan Silva', '2026-02-10 10:00:00+05:30'),
  ('d1000001-0000-0000-0000-000000000006', 'a1000001-0000-0000-0000-000000000001', 'dc21f767-fbe2-4626-a1f0-b6d4ea3b762b', 'BUY', '2026-02-15', 800, 1150.00, 920000.00, 10304.00, 'e2876fd6-ca0f-4165-9904-a7f265377875', 'b1000001-0000-0000-0000-000000000001', 'LIMIT', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 930304.00, 'APPROVED', 'Anura Wickramasinghe', 'Chamari Gunawardena', '2026-02-15 15:30:00+05:30'),
  ('d1000001-0000-0000-0000-000000000007', 'a1000001-0000-0000-0000-000000000002', '95aa91f1-0a3e-44d6-8ea8-6b85ef12d3f6', 'SELL', '2026-02-20', 2500, 380.25, 950625.00, 10647.00, '14167eaa-d176-493b-a75a-0e572a719273', 'b1000001-0000-0000-0000-000000000003', 'MARKET', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 939978.00, 'APPROVED', 'Dilshan Rathnayake', 'Renuka Perera', '2026-02-20 09:15:00+05:30'),
  ('d1000001-0000-0000-0000-000000000008', 'a1000001-0000-0000-0000-000000000005', 'fda8ef55-bacc-478c-a9be-4ba17e244108', 'BUY', '2026-03-01', 4000, 218.00, 872000.00, 9766.00, 'bd068dd0-2964-4ed6-b33a-caf596513b9e', 'b1000001-0000-0000-0000-000000000006', 'MARKET', '5e8eca03-ff11-4ddf-b8c9-5b6de1d9117c', 1.12, 881766.00, 'APPROVED', 'Samanthi Jayawardena', 'Dilshan Silva', '2026-03-01 13:45:00+05:30')
ON CONFLICT (id) DO NOTHING;

-- Insert Transaction Requests
INSERT INTO transaction_requests (id, entity_id, share_id, transaction_type, no_of_shares, price_per_share, total_amount, request_date, status, requested_by, notes, validity_period_hours)
VALUES
  ('e1000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'c0d24b81-aff9-4d60-a623-5af58cf83af0', 'BUY', 3000, 190.00, 570000.00, '2026-03-10', 'PENDING', 'Anura Wickramasinghe', 'Buy JKH at market price as per investment strategy', 48),
  ('e1000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000002', '8eeda130-ad7c-4c1d-9560-52d792cdd0ba', 'SELL', 2000, 430.00, 860000.00, '2026-03-11', 'APPROVED', 'Dilshan Rathnayake', 'Partial sell of LOLC to rebalance portfolio', 24),
  ('e1000001-0000-0000-0000-000000000003', 'a1000001-0000-0000-0000-000000000003', '04cd72b6-8840-4d04-80be-0148b0d57fa2', 'BUY', 1000, 248.00, 248000.00, '2026-03-12', 'PENDING', 'Rohan Perera', 'Additional HNB purchase for long-term hold', 48),
  ('e1000001-0000-0000-0000-000000000004', 'a1000001-0000-0000-0000-000000000004', 'e445cc80-fb61-46ad-95d0-4ddb2fa60593', 'BUY', 2000, 325.00, 650000.00, '2026-03-13', 'REJECTED', 'Nisha Fernando', 'Buy Commercial Bank shares', 24),
  ('e1000001-0000-0000-0000-000000000005', 'a1000001-0000-0000-0000-000000000005', 'fda8ef55-bacc-478c-a9be-4ba17e244108', 'SELL', 1500, 220.00, 330000.00, '2026-03-14', 'PENDING', 'Samanthi Jayawardena', 'Profit taking on Hemas position', 48),
  ('e1000001-0000-0000-0000-000000000006', 'a1000001-0000-0000-0000-000000000001', 'dc21f767-fbe2-4626-a1f0-b6d4ea3b762b', 'SELL', 400, 1175.00, 470000.00, '2026-03-15', 'PENDING', 'Anura Wickramasinghe', 'Trimming CTC position ahead of results', 48)
ON CONFLICT (id) DO NOTHING;

-- Insert Transaction Approvals (for approved requests)
INSERT INTO transaction_approvals (id, transaction_request_id, approved_by, approval_date, approval_notes)
VALUES
  ('f1000001-0000-0000-0000-000000000001', 'e1000001-0000-0000-0000-000000000002', 'Renuka Perera', '2026-03-11 14:30:00+05:30', 'Approved as per investment committee decision. LOLC price target achieved.'),
  ('f1000001-0000-0000-0000-000000000002', 'e1000001-0000-0000-0000-000000000004', 'Dilshan Silva', '2026-03-13 16:45:00+05:30', 'Rejected - insufficient funds in account for full amount. Requested to reduce quantity.')
ON CONFLICT (id) DO NOTHING;
