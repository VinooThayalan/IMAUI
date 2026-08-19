/**
 * Pre-system holdings (`entity_share_opening_balances`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface OpeningBalanceRow {
  entity_id: string;
  share_id: string;
  opening_shares: number | string;
  average_purchase_cost: number | string;
  effective_date: string;
}

export async function listAll(): Promise<OpeningBalanceRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('entity_share_opening_balances')
      .select('entity_id, share_id, opening_shares, average_purchase_cost, effective_date')
      .order('id', { ascending: true }),
  );
  return rows as unknown as OpeningBalanceRow[];
}
