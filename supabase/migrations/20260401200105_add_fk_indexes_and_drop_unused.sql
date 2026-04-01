/*
  # Add foreign key indexes and drop unused indexes

  1. New Indexes (33 FK indexes)
    - Adds indexes on all foreign key columns that were missing covering indexes
    - Tables affected: amalgamations, banks, cash_balance_ledger, corporate_action_history,
      daily_share_prices, dividends, entities, scrip_entries, sector_types, share_52week_values,
      share_dividends_per_share, share_earnings, share_values, shares, transaction_approvals,
      transaction_documents, transaction_requests, transactions, user_entity_access, user_menu_access

  2. Dropped Indexes (32 unused indexes)
    - Removes indexes that have never been used, reducing write overhead and storage
    - Tables affected: transactions, buy_sell_notes, entities, scrip_entries, entity_brokers,
      share_dividends_per_share, share_52week_values, share_earnings, share_values,
      cash_balance_ledger, buy_sell_approvals, corporate_actions, rights_issues,
      amalgamations, share_buybacks, share_subdivisions, corporate_action_history,
      fee_rates, fee_components

  3. Important Notes
    - FK indexes improve JOIN and DELETE performance on referenced tables
    - Unused indexes waste storage and slow down INSERT/UPDATE operations
*/

-- ============================================
-- ADD MISSING FOREIGN KEY INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_fk_amalgamations_new_share_id ON amalgamations(new_share_id);
CREATE INDEX IF NOT EXISTS idx_fk_amalgamations_old_share_id ON amalgamations(old_share_id);
CREATE INDEX IF NOT EXISTS idx_fk_banks_entity_id ON banks(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_banks_share_id ON banks(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_cash_balance_ledger_bank_id ON cash_balance_ledger(bank_id);
CREATE INDEX IF NOT EXISTS idx_fk_cash_balance_ledger_entity_id ON cash_balance_ledger(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_corporate_action_history_corporate_action_id ON corporate_action_history(corporate_action_id);
CREATE INDEX IF NOT EXISTS idx_fk_daily_share_prices_share_id ON daily_share_prices(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_dividends_entity_id ON dividends(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_dividends_share_id ON dividends(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_entities_entity_type_id ON entities(entity_type_id);
CREATE INDEX IF NOT EXISTS idx_fk_scrip_entries_entity_id ON scrip_entries(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_scrip_entries_share_id ON scrip_entries(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_sector_types_industry_id ON sector_types(industry_id);
CREATE INDEX IF NOT EXISTS idx_fk_share_52week_values_share_id ON share_52week_values(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_share_dividends_per_share_entity_id ON share_dividends_per_share(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_share_dividends_per_share_share_id ON share_dividends_per_share(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_share_earnings_entity_id ON share_earnings(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_share_earnings_share_id ON share_earnings(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_share_values_entity_id ON share_values(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_share_values_share_id ON share_values(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_shares_industry_id ON shares(industry_id);
CREATE INDEX IF NOT EXISTS idx_fk_shares_sector_id ON shares(sector_id);
CREATE INDEX IF NOT EXISTS idx_fk_transaction_approvals_transaction_request_id ON transaction_approvals(transaction_request_id);
CREATE INDEX IF NOT EXISTS idx_fk_transaction_documents_transaction_request_id ON transaction_documents(transaction_request_id);
CREATE INDEX IF NOT EXISTS idx_fk_transaction_requests_entity_id ON transaction_requests(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_transaction_requests_share_id ON transaction_requests(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_transactions_bank_id ON transactions(bank_id);
CREATE INDEX IF NOT EXISTS idx_fk_transactions_broker_id ON transactions(broker_id);
CREATE INDEX IF NOT EXISTS idx_fk_transactions_brokerage_fee_type_id ON transactions(brokerage_fee_type_id);
CREATE INDEX IF NOT EXISTS idx_fk_transactions_entity_id ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_transactions_share_id ON transactions(share_id);
CREATE INDEX IF NOT EXISTS idx_fk_user_entity_access_entity_id ON user_entity_access(entity_id);
CREATE INDEX IF NOT EXISTS idx_fk_user_menu_access_menu_item_id ON user_menu_access(menu_item_id);

-- ============================================
-- DROP UNUSED INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_transactions_approval_status;
DROP INDEX IF EXISTS idx_transactions_approval_expires_at;
DROP INDEX IF EXISTS idx_buy_sell_notes_broker_id;
DROP INDEX IF EXISTS idx_entities_current_balance;
DROP INDEX IF EXISTS idx_scrip_entries_broker_id;
DROP INDEX IF EXISTS idx_scrip_entries_bank_id;
DROP INDEX IF EXISTS idx_scrip_entries_transaction_type;
DROP INDEX IF EXISTS idx_entity_brokers_broker_name_id;
DROP INDEX IF EXISTS idx_div_per_share_effective_date;
DROP INDEX IF EXISTS idx_52week_effective_date;
DROP INDEX IF EXISTS idx_52week_timestamp;
DROP INDEX IF EXISTS idx_earnings_effective_date;
DROP INDEX IF EXISTS idx_earnings_timestamp;
DROP INDEX IF EXISTS idx_values_effective_date;
DROP INDEX IF EXISTS idx_values_timestamp;
DROP INDEX IF EXISTS idx_div_per_share_timestamp;
DROP INDEX IF EXISTS idx_buy_sell_notes_note_type;
DROP INDEX IF EXISTS idx_buy_sell_notes_settlement_date;
DROP INDEX IF EXISTS idx_ledger_type;
DROP INDEX IF EXISTS idx_buy_sell_approvals_status;
DROP INDEX IF EXISTS idx_buy_sell_notes_brokerage_fee_type;
DROP INDEX IF EXISTS idx_corporate_actions_share_id;
DROP INDEX IF EXISTS idx_corporate_actions_action_type;
DROP INDEX IF EXISTS idx_corporate_actions_status;
DROP INDEX IF EXISTS idx_rights_issues_corporate_action_id;
DROP INDEX IF EXISTS idx_amalgamations_corporate_action_id;
DROP INDEX IF EXISTS idx_share_buybacks_corporate_action_id;
DROP INDEX IF EXISTS idx_share_subdivisions_corporate_action_id;
DROP INDEX IF EXISTS idx_corporate_action_history_share_id;
DROP INDEX IF EXISTS idx_entity_brokers_is_active;
DROP INDEX IF EXISTS idx_fee_rates_component;
DROP INDEX IF EXISTS idx_fee_components_active;
