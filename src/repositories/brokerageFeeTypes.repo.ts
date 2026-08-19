/**
 * Brokerage fee tiers (`brokerage_fee_types`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface FeeTypeRow {
  rate: number | string;
  min_price: number | string | null;
}

/** Active tiers, cheapest first. The first is the default when none is stored. */
export async function listActive(): Promise<FeeTypeRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('brokerage_fee_types')
      .select('rate, min_price')
      .eq('is_active', true)
      .order('min_price', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true }),
  );
  return rows as unknown as FeeTypeRow[];
}
