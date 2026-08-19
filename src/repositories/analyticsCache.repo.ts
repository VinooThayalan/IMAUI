/**
 * Read access to `share_analytics_cache`.
 *
 * One computed row per event per (entity, share), each carrying the cumulative
 * state *after* that event. Written by the Share Analytics compute; read by
 * Portfolio, Portfolio Summary and Share Analytics itself.
 *
 * Three screens used to hold their own copy of this query, which is how they
 * drifted apart: one ordered by `trade_date` in SQL, another sorted by it in JS
 * where a NULL became the empty string, and the third was silently truncated
 * because the read was unpaged. Concentrating it here is what stops the fourth
 * copy appearing.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

/** Raw cache row. Numeric columns arrive as strings from PostgREST. */
export interface AnalyticsCacheRow {
  entity_id: string;
  share_id: string;
  entity_name: string;
  share_ticker: string;
  share_name: string;
  share_cum_bal: number | string;
  av_cost: number | string;
  market_value: number | string;
  cum_dividend: number | string;
  cum_purchase_cost: number | string;
  cum_sale_value: number | string;
  market_price: number | string;
  brokerage_fee_rate: number | string;
  cds_accounts: string[] | null;
  aer: number | string | null;
  cash_flow: number | string;
  trade_date: string | null;
  row_index: number;
  source_hash: string;
}

/**
 * The superset every holdings reader needs.
 *
 * One column list rather than one per screen: Portfolio wants a subset of what
 * Portfolio Summary wants, and two near-identical queries is how they drifted
 * apart before. Extend deliberately — this is read on every visit.
 */
const HOLDING_COLUMNS =
  'entity_id, share_id, entity_name, share_ticker, share_name, ' +
  'share_cum_bal, av_cost, market_value, cum_dividend, ' +
  'cum_purchase_cost, cum_sale_value, market_price, brokerage_fee_rate, ' +
  'cds_accounts, aer, cash_flow, trade_date, row_index, source_hash';

/**
 * Every row of a batch, in compute order.
 *
 * The `ORDER BY` is the whole contract:
 *
 *  - `row_index` is the order the rows were computed in, and the only correct
 *    way to order them. `trade_date` ties — a buy and a sell on one day broke
 *    the tie arbitrarily, and when the buy landed last the group reported a
 *    balance inflated by the whole cancelled sale.
 *  - `id` last, because a paged read over a non-unique ordering can repeat some
 *    rows and skip others between pages.
 *  - paged via `selectAll`, because an unbounded select is capped server-side at
 *    `db-max-rows` and simply returns short.
 */
export async function findByHash(sourceHash: string): Promise<AnalyticsCacheRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('share_analytics_cache')
      .select(HOLDING_COLUMNS)
      .eq('source_hash', sourceHash)
      .order('entity_name', { ascending: true })
      .order('share_ticker', { ascending: true })
      .order('row_index', { ascending: true })
      .order('id', { ascending: true }),
  );
  // The client is untyped and the column list is composed, so supabase-js cannot
  // infer the row shape. Naming it is this layer's job; callers get real types.
  return rows as unknown as AnalyticsCacheRow[];
}
