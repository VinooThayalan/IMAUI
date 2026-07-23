/*
# Add note_not_required flag to transactions

## Purpose
Approved transactions that were created directly (without a buy/sell note) currently
appear forever in the "Upload Note" dropdown on the Buy/Sell Notes page, with no way
to dismiss them. This adds a boolean flag so a user can mark a transaction as not
needing a note, removing it from the dropdown.

## Changes
1. New column on `transactions`:
   - `note_not_required` (boolean, default false). When true, the transaction is
     excluded from the "Upload Note" dropdown in Buy/Sell Notes.

## Security
- No RLS policy changes. Existing policies on `transactions` remain unchanged.
*/

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS note_not_required boolean NOT NULL DEFAULT false;
