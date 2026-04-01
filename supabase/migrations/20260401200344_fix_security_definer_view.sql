/*
  # Fix security definer view fee_tier_summary

  1. Problem
    - View `public.fee_tier_summary` is defined with SECURITY DEFINER
    - This means the view executes with the privileges of the view owner (superuser),
      bypassing RLS policies on the underlying tables

  2. Solution
    - Recreate the view with SECURITY INVOKER (the default)
    - This ensures the view respects RLS policies of the querying user

  3. Important Notes
    - The view definition is preserved exactly as-is
    - Only the security context changes from DEFINER to INVOKER
*/

CREATE OR REPLACE VIEW public.fee_tier_summary
WITH (security_invoker = true)
AS
SELECT
  ft.tier_name,
  ft.min_transaction_value,
  ft.max_transaction_value,
  json_agg(
    json_build_object('component', fc.component_name, 'rate', fr.rate_percentage)
    ORDER BY fc.display_order
  ) AS fee_breakdown,
  sum(fr.rate_percentage) AS total_rate_percentage
FROM public.fee_tiers ft
JOIN public.fee_rates fr ON ft.id = fr.fee_tier_id
JOIN public.fee_components fc ON fr.fee_component_id = fc.id
WHERE ft.is_active = true AND fr.is_active = true AND fc.is_active = true
GROUP BY ft.id, ft.tier_name, ft.min_transaction_value, ft.max_transaction_value
ORDER BY ft.min_transaction_value;
