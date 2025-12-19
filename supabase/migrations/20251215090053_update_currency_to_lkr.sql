/*
  # Update Default Currency to LKR

  1. Changes
    - Update default currency in shares table from USD to LKR
    - Update default currency in banks table from USD to LKR
    - Update default currency in dividends table from USD to LKR
*/

-- Update shares table default currency
ALTER TABLE shares ALTER COLUMN currency SET DEFAULT 'LKR';

-- Update banks table default currency
ALTER TABLE banks ALTER COLUMN currency SET DEFAULT 'LKR';

-- Update dividends table default currency
ALTER TABLE dividends ALTER COLUMN currency SET DEFAULT 'LKR';