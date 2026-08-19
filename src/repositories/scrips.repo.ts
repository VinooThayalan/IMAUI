/**
 * Scrip issues (`scrip_entries`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface ScripRow {
  entity_id: string;
  share_id: string;
  no_of_shares: number | string;
  effective_date: string | null;
  entry_date: string;
}

/**
 * Only RECEIVED issues.
 *
 * Scrip shares arrive free: they raise the balance and leave cost untouched, so
 * average cost per share falls. A consumer that skips this table reports fewer
 * shares than the holder owns, 59,962 fewer for one entity, and every figure
 * derived from the balance is wrong with it.
 */
export async function listReceived(): Promise<ScripRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('scrip_entries')
      .select('entity_id, share_id, no_of_shares, effective_date, entry_date')
      .eq('status', 'RECEIVED')
      .order('id', { ascending: true }),
  );
  return rows as unknown as ScripRow[];
}
