/*
  # Add bank_name column to entity_brokers

  The entity_brokers table currently uses bank_id (FK to master banks table)
  to record which bank is associated with each broker/custodian relationship.
  
  This migration adds a bank_name text column so that:
  - For broker accounts: the settlement bank name from the broker's profile
    (brokers.settlement_bank_account) can be stored directly
  - For custodian accounts: a free-text bank name can be entered
  
  The existing bank_id column is preserved for backwards compatibility.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_brokers' AND column_name = 'bank_name' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.entity_brokers ADD COLUMN bank_name text;
  END IF;
END $$;
