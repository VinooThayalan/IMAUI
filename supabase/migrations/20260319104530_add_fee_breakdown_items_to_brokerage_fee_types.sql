/*
  # Add Fee Breakdown Items to Brokerage Fee Types

  ## Summary
  Adds a JSONB column to store the per-component fee breakdown for each brokerage fee tier.
  Each item has a name and rate (%). The total of all items equals the tier's overall rate.

  ## Changes
  - New column: `fee_breakdown_items` (JSONB, default empty array)
  - Updates existing fee types with standard CSE fee components from the fee schedule

  ## Fee Components (per CSE regulations)
  - Brokerage Fee
  - CSE Fees
  - CDS Fees
  - Clearing Fees
  - SEC CESS
  - Share Transaction IOVY
*/

ALTER TABLE brokerage_fee_types
  ADD COLUMN IF NOT EXISTS fee_breakdown_items jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE brokerage_fee_types
SET fee_breakdown_items = '[
  {"name": "Brokerage Fee", "rate": 0.64},
  {"name": "CSE Fees", "rate": 0.084},
  {"name": "CDS Fees", "rate": 0.012},
  {"name": "Clearing Fees", "rate": 0.012},
  {"name": "SEC CESS", "rate": 0.072},
  {"name": "Share Transaction IOVY", "rate": 0.300}
]'::jsonb
WHERE name ILIKE '%below%' OR (min_price IS NULL AND max_price IS NOT NULL);

UPDATE brokerage_fee_types
SET fee_breakdown_items = '[
  {"name": "Brokerage Fee", "rate": 0.200},
  {"name": "CSE Fees", "rate": 0.0525},
  {"name": "CDS Fees", "rate": 0.0075},
  {"name": "Clearing Fees", "rate": 0.0075},
  {"name": "SEC CESS", "rate": 0.0450},
  {"name": "Share Transaction IOVY", "rate": 0.300}
]'::jsonb
WHERE name ILIKE '%above%' OR (min_price IS NOT NULL AND max_price IS NULL);
