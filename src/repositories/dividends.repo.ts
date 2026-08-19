/**
 * Dividend receipts (`dividends`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface DividendRow {
  entity_id: string;
  share_id: string;
  payment_date: string | null;
  amount_net: number | string;
}

export async function listAll(): Promise<DividendRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('dividends')
      .select('entity_id, share_id, payment_date, amount_net')
      .order('id', { ascending: true }),
  );
  return rows as unknown as DividendRow[];
}
