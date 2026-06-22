-- Set brokerage_fee_rate = 1.12 for all LOLC Holdings PLC transactions
-- share_id = 'a71ca24b-76da-4bc3-bb6a-3f7056726393' (LOLC.N0000)
UPDATE transactions
SET brokerage_fee_rate = 1.12
WHERE share_id = 'a71ca24b-76da-4bc3-bb6a-3f7056726393'
  AND brokerage_fee_rate IS NULL;
