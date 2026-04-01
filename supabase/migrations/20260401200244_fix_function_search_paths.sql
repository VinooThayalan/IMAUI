/*
  # Fix mutable search paths on public functions

  1. Problem
    - 14 functions in the public schema have mutable search_path settings
    - This is a security risk: an attacker could manipulate the search_path
      to substitute malicious objects for expected ones

  2. Solution
    - Set `search_path = ''` on all affected functions
    - This forces fully-qualified references, preventing search_path manipulation

  3. Affected Functions
    - update_buy_sell_approvals_updated_at()
    - generate_broker_id()
    - set_broker_id()
    - generate_industry_id()
    - generate_sector_id()
    - set_industry_id()
    - set_sector_id()
    - get_fee_tier_for_value(numeric)
    - calculate_transaction_fees(numeric)
    - handle_new_user()
    - generate_entity_id()
    - update_cash_balance_updated_at()
    - update_updated_at_column()
    - update_buy_sell_notes_updated_at()
*/

ALTER FUNCTION public.update_buy_sell_approvals_updated_at() SET search_path = '';
ALTER FUNCTION public.generate_broker_id() SET search_path = '';
ALTER FUNCTION public.set_broker_id() SET search_path = '';
ALTER FUNCTION public.generate_industry_id() SET search_path = '';
ALTER FUNCTION public.generate_sector_id() SET search_path = '';
ALTER FUNCTION public.set_industry_id() SET search_path = '';
ALTER FUNCTION public.set_sector_id() SET search_path = '';
ALTER FUNCTION public.get_fee_tier_for_value(numeric) SET search_path = '';
ALTER FUNCTION public.calculate_transaction_fees(numeric) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.generate_entity_id() SET search_path = '';
ALTER FUNCTION public.update_cash_balance_updated_at() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.update_buy_sell_notes_updated_at() SET search_path = '';
