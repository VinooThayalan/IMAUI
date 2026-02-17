/*
  # Create Fee Calculation Function

  1. Changes
    - Create a function to calculate fees based on transaction value
    - Create a view to easily see all fee tiers with totals
    - This makes it easy to calculate fees for any transaction amount

  2. Functions
    - `calculate_transaction_fees(transaction_value)` - Returns detailed breakdown and total fees
*/

-- Create a function to get applicable fee tier for a transaction value
CREATE OR REPLACE FUNCTION get_fee_tier_for_value(transaction_value decimal)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM fee_tiers
  WHERE is_active = true
    AND transaction_value >= min_transaction_value
    AND (max_transaction_value IS NULL OR transaction_value <= max_transaction_value)
  ORDER BY min_transaction_value DESC
  LIMIT 1;
$$;

-- Create a function to calculate all fees for a transaction
CREATE OR REPLACE FUNCTION calculate_transaction_fees(transaction_value decimal)
RETURNS TABLE(
  component_name text,
  rate_percentage decimal,
  fee_amount decimal
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    fc.component_name,
    fr.rate_percentage,
    ROUND((transaction_value * fr.rate_percentage / 100), 2) as fee_amount
  FROM fee_rates fr
  JOIN fee_components fc ON fr.fee_component_id = fc.id
  WHERE fr.fee_tier_id = get_fee_tier_for_value(transaction_value)
    AND fr.is_active = true
    AND fc.is_active = true
  ORDER BY fc.display_order;
$$;

-- Create a view to show fee tier summaries
CREATE OR REPLACE VIEW fee_tier_summary AS
SELECT 
  ft.tier_name,
  ft.min_transaction_value,
  ft.max_transaction_value,
  json_agg(
    json_build_object(
      'component', fc.component_name,
      'rate', fr.rate_percentage
    ) ORDER BY fc.display_order
  ) as fee_breakdown,
  SUM(fr.rate_percentage) as total_rate_percentage
FROM fee_tiers ft
JOIN fee_rates fr ON ft.id = fr.fee_tier_id
JOIN fee_components fc ON fr.fee_component_id = fc.id
WHERE ft.is_active = true 
  AND fr.is_active = true 
  AND fc.is_active = true
GROUP BY ft.id, ft.tier_name, ft.min_transaction_value, ft.max_transaction_value
ORDER BY ft.min_transaction_value;
