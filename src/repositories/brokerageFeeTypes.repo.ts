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

export interface FeeTypeNameRow {
  id: string;
  name: string;
}

/**
 * Every tier's name, active or not. A transaction keeps the tier it was booked
 * under after that tier is retired, and its email still has to name it.
 */
export async function listNames(): Promise<FeeTypeNameRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('brokerage_fee_types')
      .select('id, name')
      .order('id', { ascending: true }),
  );
  return rows as unknown as FeeTypeNameRow[];
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
