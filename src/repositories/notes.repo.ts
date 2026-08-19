/**
 * Contract notes (`buy_sell_notes`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface NoteRow {
  id: string;
  note_type: string;
  trade_date: string | null;
  no_of_shares: number | string;
  price_avg: number | string | null;
  gross_amount: number | string;
  net_amount: number | string;
  transaction_id: string | null;
}

/**
 * Only PROCESSED notes.
 *
 * The status filter is the point. A REJECTED or PENDING note is not a settled
 * trade, and a consumer that reads notes without filtering counts amounts the
 * ledger must not see, which is how the Dashboard's figures drifted from every
 * cache-based screen.
 */
export async function listProcessed(): Promise<NoteRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('buy_sell_notes')
      .select('id, note_type, trade_date, no_of_shares, price_avg, gross_amount, net_amount, transaction_id')
      .eq('status', 'PROCESSED')
      .order('trade_date', { ascending: true })
      .order('id', { ascending: true }),
  );
  return rows as unknown as NoteRow[];
}
