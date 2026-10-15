-- The custodian's "Account Fee %" becomes "Applicable Facility Interest Rate",
-- written as text such as 'AWPLR + 2%'. See bug-60.
-- custodian_account_fee stays until the frontend no longer writes it.

ALTER TABLE public.entity_brokers ADD COLUMN IF NOT EXISTS facility_interest_rate text;

COMMENT ON COLUMN public.entity_brokers.facility_interest_rate IS
  'Applicable facility interest rate as stated, e.g. AWPLR + 2%. Null: not stated.';

UPDATE public.entity_brokers
SET facility_interest_rate = trim_scale(custodian_account_fee)::text || '%'
WHERE custodian_account_fee IS NOT NULL
  AND facility_interest_rate IS NULL;
