/**
 * Entity master (`entities`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface EntityMasterRow {
  id: string;
  name: string;
  current_balance: number | string | null;
}

export async function listAll(): Promise<EntityMasterRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('entities')
      .select('id, name, current_balance')
      .order('name', { ascending: true })
      .order('id', { ascending: true }),
  );
  return rows as unknown as EntityMasterRow[];
}
