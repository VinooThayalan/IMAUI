/*
  # Clean Bank Accounts - Keep Only Metro Corp & De Silva Ventures

  ## Summary
  Nullifies foreign key references in entity_brokers for orphaned bank records,
  removes all bank account records not associated with Metrocorp or De Silva Ventures,
  then adds one bank account for Metrocorp so the total is exactly 4 records.

  ## Changes
  - NULL out entity_brokers.bank_id for any rows referencing banks that will be deleted
  - DELETE all banks rows where entity_id is NULL or not linked to the two entities
  - INSERT one Commercial Bank account for Metrocorp

  ## Result
  4 bank accounts remain:
    - De Silva Ventures: Commercial Bank, Hatton National Bank, Sampath Bank (3)
    - Metrocorp: Commercial Bank (1)
*/

UPDATE entity_brokers
SET bank_id = NULL
WHERE bank_id IN (
  SELECT id FROM banks
  WHERE entity_id IS NULL
     OR entity_id NOT IN (
       '0182e51f-63ea-44d6-bfe5-de7c178a40f9',
       '765a77df-8f30-4f14-8420-94d1d0e159bc'
     )
);

DELETE FROM banks
WHERE entity_id IS NULL
   OR entity_id NOT IN (
     '0182e51f-63ea-44d6-bfe5-de7c178a40f9',
     '765a77df-8f30-4f14-8420-94d1d0e159bc'
   );

INSERT INTO banks (entity_id, name, account_number, branch, currency, balance)
VALUES (
  '765a77df-8f30-4f14-8420-94d1d0e159bc',
  'Commercial Bank',
  '1100123456',
  'Colombo 03',
  'LKR',
  0
);
