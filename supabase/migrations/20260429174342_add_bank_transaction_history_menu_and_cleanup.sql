/*
  # Add Bank Transaction History menu item and clean up Banks master data

  1. Menu Items
     - Insert 'bank-transaction-history' under Master Data section (sort_order 20)

  2. Banks cleanup
     - Remove the "Amana Bank" entity-bank record (entity 'l', bank id 68aa4211)
     - Remove the associated cash ledger entries for that bank so no orphan data
     - Remove entity 'b708529b' (name 'l') which was a dummy/empty entity
*/

-- Insert menu item for bank transaction history
INSERT INTO menu_items (menu_name, label, section, sort_order, is_active)
VALUES ('bank-transaction-history', 'Bank Transaction History', 'Master Data', 20, true)
ON CONFLICT (menu_name) DO NOTHING;

-- Remove cash ledger entries for Amana Bank account before removing the bank
DELETE FROM cash_balance_ledger
WHERE bank_id = '68aa4211-33a1-40bc-b5bd-ac31d7817c88';

-- Remove the Amana Bank entity-bank record
DELETE FROM banks
WHERE id = '68aa4211-33a1-40bc-b5bd-ac31d7817c88';

-- Remove the empty/dummy entity (name 'l', entity_id 'ENT002')
DELETE FROM entities
WHERE id = 'b708529b-44e3-43b7-9bbf-f3d02e78a24f';
