/**
 * Approved transactions (`transactions`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface TransactionRow {
  id: string;
  entity_id: string;
  share_id: string;
  cds_account_id: string | null;
  brokerage_fee_rate: number | string | null;
  transaction_date: string | null;
  transaction_type: string;
  no_of_shares: number | string;
  total_amount: number | string;
}

/** Only MANUAL_APPROVED. Anything else is not part of the book. */
export async function listApproved(): Promise<TransactionRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('transactions')
      .select('id, entity_id, share_id, cds_account_id, brokerage_fee_rate, transaction_date, transaction_type, no_of_shares, total_amount')
      .in('approval_status', ['MANUAL_APPROVED'])
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true }),
  );
  return rows as unknown as TransactionRow[];
}

/** Writes `values` onto one transaction. Throws the PostgREST error. */
export async function update(id: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('transactions').update(values).eq('id', id);
  if (error) throw error;
}

export interface NoteReviewTransactionRow {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_type: string;
  no_of_shares: number | string;
  price_per_share: number | string;
  total_amount: number | string;
  transaction_date: string | null;
  fees: number | string | null;
  brokerage_fee: number | string | null;
  cse_fee: number | string | null;
  cds_fee: number | string | null;
  clearing_fee: number | string | null;
  sec_cess: number | string | null;
  share_transaction_levy: number | string | null;
  cds_account_id: string | null;
  broker_id: string | null;
}

/** Every transaction, any status, for matching contract notes to. */
export async function listForNoteReview(): Promise<NoteReviewTransactionRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('transactions')
      .select('id, entity_id, share_id, transaction_type, no_of_shares, price_per_share, total_amount, transaction_date, fees, brokerage_fee, cse_fee, cds_fee, clearing_fee, sec_cess, share_transaction_levy, cds_account_id, broker_id')
      .order('id', { ascending: true }),
  );
  return rows as unknown as NoteReviewTransactionRow[];
}
