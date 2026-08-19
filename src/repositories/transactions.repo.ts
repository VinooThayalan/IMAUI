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
