/**
 * The cash book (`cash_balance_ledger`) and the trades that feed it.
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface CashLedgerRow {
  id: string;
  /** Only these two values exist in the table; the domain type asserts the same. */
  type: 'Addition' | 'Deduction';
  description: string | null;
  amount: number | string;
  timestamp: string;
  running_balance: number | string;
  entity_id: string | null;
  /** The `buy_sell_notes.id` this entry settles, when it came from a trade. */
  reference_id: string | null;
  created_by: string | null;
  notes: string | null;
  code: string | null;
  date: string;
  bank_id: string | null;
  on_hold_amount: number | string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

/** Newest first, matching how the ledger reads on screen. */
export async function listAll(): Promise<CashLedgerRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('cash_balance_ledger')
      .select('id, type, description, amount, timestamp, running_balance, entity_id, reference_id, created_by, notes, code, date, bank_id, on_hold_amount, source, created_at, updated_at')
      .order('date', { ascending: false })
      .order('timestamp', { ascending: false })
      .order('id', { ascending: true }),
  );
  return rows as unknown as CashLedgerRow[];
}

export interface PendingTradeNoteRow {
  id: string;
  note_type: 'Buy' | 'Sell';
  contract_no: string | null;
  note_number: string | null;
  net_amount: number | string | null;
  trade_date: string | null;
  settlement_date: string | null;
  status: string;
  transaction_id: string | null;
  transactions: { entity_id: string } | { entity_id: string }[] | null;
}

/** Trades awaiting approval: money committed but not yet in the ledger. */
export async function listPendingTradeNotes(): Promise<PendingTradeNoteRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('buy_sell_notes')
      .select('id, note_type, contract_no, note_number, net_amount, trade_date, settlement_date, status, transaction_id, transactions!inner(entity_id)')
      .eq('status', 'PENDING_APPROVAL')
      .order('id', { ascending: true }),
  );
  return rows as unknown as PendingTradeNoteRow[];
}

export interface NoteDatesRow {
  id: string;
  trade_date: string | null;
  settlement_date: string | null;
}

/**
 * Trade and settlement dates for every contract note, keyed by id.
 *
 * The ledger has no date columns of its own beyond the posting date, but 476 of
 * its 477 referencing entries point at a note through `reference_id`. This is
 * how a posted entry recovers the dates of the trade that produced it.
 */
export async function listNoteDates(): Promise<NoteDatesRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('buy_sell_notes')
      .select('id, trade_date, settlement_date')
      .order('id', { ascending: true }),
  );
  return rows as unknown as NoteDatesRow[];
}
