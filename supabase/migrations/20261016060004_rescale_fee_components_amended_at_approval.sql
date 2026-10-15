-- Three Test transactions were amended at approval before approvals rescaled the
-- fee components (bug-54, #157): fees and totals were recalculated, the six
-- components were left at the submitted figures. Rescale them by approved gross /
-- submitted gross, the rule approvals now apply. Each row is changed only while
-- it still holds the submitted components, and the change is audited
-- (set_audit_log_actor records a migration as 'system').

WITH fix (id, brokerage_fee, cse_fee, cds_fee, clearing_fee, sec_cess, share_transaction_levy,
          old_brokerage_fee, old_cse_fee, old_cds_fee, old_clearing_fee, old_sec_cess, old_share_transaction_levy) AS (
  VALUES
    -- JKH.N0000: 99,000 -> 100,000 shares @ 20.00
    ('c3a55c2b-7af6-498e-9cc6-782df7f1041a'::uuid, 12800.00, 1680.00, 240.00, 240.00, 1440.00, 6000.00,
     12672.00, 1663.20, 237.60, 237.60, 1425.60, 5940.00),
    -- SAMP.N0000: 627,000 @ 143.00 -> 630,000 @ 142.00
    ('bd52050e-02fb-4e15-9215-688afdd030a6'::uuid, 572544.00, 75146.40, 10735.20, 10735.20, 64411.20, 268380.00,
     573830.40, 75315.24, 10759.32, 10759.32, 64555.92, 268983.00),
    -- AHUN.N0000: 10 -> 15 shares @ 1,000.00
    ('e460c6e8-25e8-4f7d-bd99-eea649fbbdfd'::uuid, 96.00, 12.60, 1.80, 1.80, 10.80, 45.00,
     64.00, 8.40, 1.20, 1.20, 7.20, 30.00)
),
upd AS (
  UPDATE public.transactions t
  SET brokerage_fee = f.brokerage_fee,
      cse_fee = f.cse_fee,
      cds_fee = f.cds_fee,
      clearing_fee = f.clearing_fee,
      sec_cess = f.sec_cess,
      share_transaction_levy = f.share_transaction_levy
  FROM fix f
  WHERE t.id = f.id
    AND t.brokerage_fee = f.old_brokerage_fee
    AND t.cse_fee = f.old_cse_fee
    AND t.cds_fee = f.old_cds_fee
    AND t.clearing_fee = f.old_clearing_fee
    AND t.sec_cess = f.old_sec_cess
    AND t.share_transaction_levy = f.old_share_transaction_levy
  RETURNING t.entity_id, f.*
)
INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_values, new_values, changed_fields, entity_id, description)
SELECT
  'transactions',
  upd.id::text,
  'UPDATE',
  'system',
  jsonb_build_object(
    'brokerage_fee', upd.old_brokerage_fee, 'cse_fee', upd.old_cse_fee, 'cds_fee', upd.old_cds_fee,
    'clearing_fee', upd.old_clearing_fee, 'sec_cess', upd.old_sec_cess, 'share_transaction_levy', upd.old_share_transaction_levy),
  jsonb_build_object(
    'brokerage_fee', upd.brokerage_fee, 'cse_fee', upd.cse_fee, 'cds_fee', upd.cds_fee,
    'clearing_fee', upd.clearing_fee, 'sec_cess', upd.sec_cess, 'share_transaction_levy', upd.share_transaction_levy),
  ARRAY['brokerage_fee', 'cse_fee', 'cds_fee', 'clearing_fee', 'sec_cess', 'share_transaction_levy'],
  upd.entity_id::text,
  'Migration 20261016060004: fee components rescaled to the approved gross; approval had left them at the submitted figures (#157)'
FROM upd;
