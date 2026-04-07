/*
  # Remove All Test Data

  Deletes all seeded/dummy test data from transactional and relational tables.
  Preserved tables: entities, app_users (auth.users), and all reference/master
  data (shares, brokers, brokerage_fee_types, entity_types, industry_types,
  sector_types, fee_components, fee_tiers, fee_rates, currencies, menu_items,
  user_menu_access).

  ## Deletion Order (respects foreign key constraints)

  1. buy_sell_approvals     — references buy_sell_notes
  2. buy_sell_notes         — references transactions, brokers, brokerage_fee_types
  3. transactions           — references entities, shares, brokers, banks, brokerage_fee_types
  4. scrip_entries          — references entities, shares, brokers, banks
  5. dividends              — references entities, shares
  6. cash_balance_ledger    — references entities, banks
  7. entity_brokers         — references entities, brokers, banks
  8. daily_share_prices     — references shares
  9. user_entity_access     — references app_users, entities
  10. banks                 — references entities, shares
*/

DELETE FROM buy_sell_approvals;
DELETE FROM buy_sell_notes;
DELETE FROM transactions;
DELETE FROM scrip_entries;
DELETE FROM dividends;
DELETE FROM cash_balance_ledger;
DELETE FROM entity_brokers;
DELETE FROM daily_share_prices;
DELETE FROM user_entity_access;
DELETE FROM banks;
