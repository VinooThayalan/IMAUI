/**
 * The fingerprint every analytics cache is keyed by.
 *
 * The latest `updated_at` across every table that feeds a computed report. If
 * none of them has moved, a cached batch is still valid; if any has, the batch
 * is stale and must be recomputed.
 *
 * This lived inline in ShareAnalytics, PortfolioSummary and Portfolio — three
 * copies of the same eight probes and the same join order. A hash that differs
 * by a single table between screens silently means "never a cache hit", so
 * having one definition is the point.
 */

import { supabase } from '../lib/supabase';

/** Tables whose contents can change a computed figure, in hash order. */
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

async function latestUpdatedAt(table: string): Promise<string> {
  const { data } = await supabase
    .from(table)
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);
  return data?.[0]?.updated_at ?? '0';
}

/**
 * Current fingerprint. Order is fixed by SOURCE_TABLES: the hash is positional,
 * so reordering that list invalidates every cached batch at once.
 */
export async function current(): Promise<string> {
  const stamps = await Promise.all(SOURCE_TABLES.map(latestUpdatedAt));
  return btoa(stamps.join('|')).replace(/[/+=]/g, '');
}
