/**
 * The fingerprint every analytics cache is keyed by.
 *
 * Probes each table that feeds a computed report. If nothing has moved, a cached
 * batch is still valid; if anything has, the batch is stale and must be
 * recomputed.
 *
 * This lived inline in ShareAnalytics, PortfolioSummary and Portfolio — three
 * copies of the same eight probes and the same join order. A hash that differs
 * by a single table between screens silently means "never a cache hit", so
 * having one definition is the point.
 *
 * Data access only: what to read lives here, what it composes into lives in
 * `lib/fingerprint`, where it can be asserted without a database.
 */

import { supabase } from '../lib/supabase';
import { fingerprintOf, type TableStamp } from '../lib/fingerprint';

/** Tables whose contents can change a computed figure. */
const SOURCE_TABLES = [
  'buy_sell_notes',
  'transactions',
  'entity_share_opening_balances',
  'dividends',
  'daily_share_prices',
  'scrip_entries',
  'shares',
  'entities',
] as const;

/**
 * The latest `updated_at` and the row count, in one request.
 *
 * `nullsFirst: false` matters: Postgres sorts nulls first on a descending order,
 * so a single row with a null `updated_at` would win this probe and the table
 * would report `'0'` for good — silently dropping out of the fingerprint. No such
 * row exists today, which is exactly why it would have gone unnoticed.
 *
 * The count is what makes a delete visible. `max(updated_at)` does not move when
 * the row removed was not the newest.
 */
async function stampFor(table: string): Promise<TableStamp> {
  const { data, count } = await supabase
    .from(table)
    .select('updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1);

  return {
    table,
    updatedAt: data?.[0]?.updated_at ?? '0',
    rows: count ?? 0,
  };
}

/** Current fingerprint across every source table. */
export async function current(): Promise<string> {
  const stamps = await Promise.all(SOURCE_TABLES.map(stampFor));
  return fingerprintOf(stamps);
}
