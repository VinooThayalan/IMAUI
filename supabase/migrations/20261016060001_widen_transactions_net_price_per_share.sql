-- transactions.net_price_per_share was numeric(15,2), so the form's 20.2240 was
-- stored as 20.22. Widen it and restate it as net / shares. See bug-53 (#156).

ALTER TABLE public.transactions ALTER COLUMN net_price_per_share TYPE numeric;

-- Keep updated_at: the backfill restores precision, it is not an edit.
ALTER TABLE public.transactions DISABLE TRIGGER update_transactions_updated_at;

UPDATE public.transactions
SET net_price_per_share = round(total_amount / no_of_shares, 6)
WHERE no_of_shares > 0
  AND total_amount IS NOT NULL;

ALTER TABLE public.transactions ENABLE TRIGGER update_transactions_updated_at;
