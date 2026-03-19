/*
  # Add Buy & Sell Notes Data

  ## Summary
  Updates the 2 existing incomplete buy/sell notes with full financial details,
  and inserts 8 new notes covering all remaining De Silva Ventures transactions.

  ## Changes
  - UPDATE 2 existing buy_sell_notes rows with trade_date, no_of_shares, price_avg,
    gross_amount, brokerage, sec, exchange, cds, net_amount, broker_id, dealer_name, contract_no
  - INSERT 8 new buy_sell_notes rows for remaining De Silva Ventures transactions

  ## Notes Added
  - All notes reflect realistic Sri Lankan CSE fee structures (brokerage 1.25%, SEC 0.03%, exchange 0.05%, CDS 0.01%)
  - Buy notes: net_amount = gross + fees
  - Sell notes: net_amount = gross - fees
  - Settlement date = trade date + 3 business days
*/

UPDATE buy_sell_notes
SET
  broker_id        = 'e2876fd6-ca0f-4165-9904-a7f265377875',
  dealer_name      = 'Rajith Fernando',
  trade_date       = '2024-04-18',
  settlement_date  = '2024-04-23',
  contract_no      = 'JKSB-2024-04-016',
  no_of_shares     = 1000,
  price_avg        = 74.00,
  gross_amount     = 74000.00,
  brokerage        = 925.00,
  sec              = 22.20,
  exchange         = 37.00,
  cds              = 7.40,
  gov_cess         = 0,
  clearing_fees    = 0,
  net_amount       = 74991.60
WHERE id = 'f51ab446-315c-4977-8df9-187988b7bce3';

UPDATE buy_sell_notes
SET
  broker_id        = '14167eaa-d176-493b-a75a-0e572a719273',
  dealer_name      = 'Priya Wijesinghe',
  trade_date       = '2024-07-05',
  settlement_date  = '2024-07-10',
  contract_no      = 'CAS-2024-07-025',
  no_of_shares     = 80,
  price_avg        = 1470.00,
  gross_amount     = 117600.00,
  brokerage        = 1470.00,
  sec              = 35.28,
  exchange         = 58.80,
  cds              = 11.76,
  gov_cess         = 0,
  clearing_fees    = 0,
  net_amount       = 119175.84
WHERE id = '6a6de8de-8a9c-4655-848f-19f8c64d9c3f';

INSERT INTO buy_sell_notes (
  transaction_id, note_type, note_number,
  broker, broker_id, dealer_name, contract_no,
  trade_date, settlement_date,
  no_of_shares, price_avg, gross_amount,
  brokerage, sec, exchange, cds, gov_cess, clearing_fees, net_amount
) VALUES
(
  '0007a4ea-f39c-45f0-9dc1-6fb86bd70ddf',
  'Buy', 'CN-2024-0038',
  'John Keells Stock Brokers',
  'e2876fd6-ca0f-4165-9904-a7f265377875',
  'Rajith Fernando', 'JKSB-2024-10-038',
  '2024-10-12', '2024-10-17',
  900, 103.00, 92700.00,
  1158.75, 27.81, 46.35, 9.27, 0, 0, 93942.18
),
(
  '93d5327e-7ebe-43a4-b2b4-8bab6bdf62bf',
  'Sell', 'CN-2024-0051',
  'First Capital Equities',
  '874e66a3-a152-4d63-818b-854bcdc86886',
  'Nimal Perera', 'FCE-2024-12-051',
  '2024-12-05', '2024-12-10',
  150, 134.00, 20100.00,
  251.25, 6.03, 10.05, 2.01, 0, 0, 19830.66
),
(
  'd2962b60-4a3f-429f-bec1-b474300bd9ff',
  'Buy', 'CN-2026-0004',
  'Acuity Stockbrokers',
  '1c3db1a6-5c08-49ca-8e9d-5b4afb23f0a7',
  'Chamara Dissanayake', 'ACU-2026-02-004',
  '2026-02-22', '2026-02-27',
  100, 149.99, 14999.00,
  187.49, 4.50, 7.50, 1.50, 0, 0, 15199.99
),
(
  '268e4c05-6eb7-4d33-8e5f-b50370765eda',
  'Buy', 'CN-2026-0007',
  'CT CLSA Securities',
  '5a8834cc-8d36-49c2-8363-568da700c7df',
  'Shalini Jayawardena', 'CTCLSA-2026-02-007',
  '2026-02-24', '2026-03-01',
  100, 150.00, 15000.00,
  187.50, 4.50, 7.50, 1.50, 0, 0, 15201.00
),
(
  '523fe9a4-2660-443e-8acb-4e45c490c063',
  'Buy', 'CN-2026-0012',
  'NDB Stockbrokers',
  'bd068dd0-2964-4ed6-b33a-caf596513b9e',
  'Kasun Rathnayake', 'NDBS-2026-03-012',
  '2026-03-05', '2026-03-10',
  100, 100.00, 10000.00,
  125.00, 3.00, 5.00, 1.00, 0, 0, 10134.00
),
(
  '97f2f1ed-3ce7-4e6f-8e3c-16b98ac7f145',
  'Buy', 'CN-2026-0019',
  'Softlogic Stockbrokers',
  '406cbfeb-0efc-40d9-8eaf-5976cf9d94c7',
  'Thilina Bandara', 'SLS-2026-03-019',
  '2026-03-10', '2026-03-15',
  1000, 12.50, 12500.00,
  156.25, 3.75, 6.25, 1.25, 0, 0, 12667.50
),
(
  'b803eaf3-d968-477d-aaf2-02d9b01d9237',
  'Buy', 'CN-2026-0020',
  'Capital Alliance Securities',
  '14167eaa-d176-493b-a75a-0e572a719273',
  'Priya Wijesinghe', 'CAS-2026-03-020',
  '2026-03-10', '2026-03-15',
  1000, 125.50, 125500.00,
  1568.75, 37.65, 62.75, 12.55, 0, 0, 127181.70
),
(
  'f4148d70-c8b8-4367-8e5a-2e47bd56ec68',
  'Buy', 'CN-2026-0027',
  'John Keells Stock Brokers',
  'e2876fd6-ca0f-4165-9904-a7f265377875',
  'Rajith Fernando', 'JKSB-2026-03-027',
  '2026-03-19', '2026-03-24',
  100, 99.99, 9999.00,
  124.99, 3.00, 5.00, 1.00, 0, 0, 10132.99
);
