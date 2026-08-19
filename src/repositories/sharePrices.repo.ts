/**
 * Daily market prices (`daily_share_prices`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface SharePriceRow {
  share_id: string;
  share_price: number | string;
  effective_date: string;
}

/**
 * Newest first, so the first row seen per share is its latest price.
 *
 * Paging matters more here than anywhere: ordered newest-first, an unpaged read
 * stops after db-max-rows, and any share whose latest price falls past that cap
 * resolves to a price of zero rather than to no answer.
 */
export async function listNewestFirst(): Promise<SharePriceRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('daily_share_prices')
      .select('share_id, share_price, effective_date')
      .order('effective_date', { ascending: false })
      .order('id', { ascending: true }),
  );
  return rows as unknown as SharePriceRow[];
}

/** share_id to latest price, and share_id to the date that price is from. */
export function latestByShare(rows: SharePriceRow[]): {
  price: Map<string, number>;
  asAt: Map<string, string>;
} {
  const price = new Map<string, number>();
  const asAt = new Map<string, string>();
  for (const r of rows) {
    if (price.has(r.share_id)) continue;
    price.set(r.share_id, Number(r.share_price) || 0);
    asAt.set(r.share_id, r.effective_date);
  }
  return { price, asAt };
}
