/**
 * Turns cached analytics rows into the holdings a portfolio report shows, for a
 * given date window.
 *
 * This is where the date-window rule lives. It was inline in Portfolio.tsx, and
 * the identical rule is inline again in ShareAnalytics and Portfolio Summary —
 * three statements of one policy, which is how they disagree.
 *
 * No React and no Supabase here: rows in, holdings out, so the rule can be
 * exercised without a browser or a database.
 */

import type { AnalyticsCacheRow } from '../repositories/analyticsCache.repo';

/** A date window. Empty strings mean unbounded, matching the date inputs. */
export interface DateWindow {
  from: string;
  to: string;
}

export const NO_WINDOW: DateWindow = { from: '', to: '' };

/** One share position, as of the window's end. */
export interface Holding {
  entityId: string;
  shareId: string;
  entityName: string;
  ticker: string;
  shareName: string;
  /** Shares held at the end of the window. */
  held: number;
  /** Average cost of those shares. */
  cost: number;
  /** Market value at the latest price on file — NOT the price on the as-at date. */
  marketValue: number;
  /** Dividends within the window, not since inception. */
  dividends: number;
}

const num = (v: number | string | null | undefined): number => Number(v) || 0;

/**
 * The end date truncates history; the start date does not.
 *
 * Every row carries the cumulative state after it, so ignoring rows traded after
 * the end date leaves the last surviving row holding the position exactly as it
 * stood that day — an as-of report, with no recomputation.
 *
 * Applying the start date the same way would do the opposite. Balance, average
 * cost and cumulative totals are all built from the purchases that came first,
 * so a report that hid them would show a holding with no record of having been
 * acquired — and an opening balance, which predates every window, would vanish
 * outright.
 *
 * The one figure a start date can honestly scope is dividends, because they
 * accumulate: the period figure is the running total at the window's end minus
 * the total already banked before it opened.
 *
 * Rows are expected in compute order (`row_index`) — see analyticsCache.repo.
 * Undated rows are always kept: an opening balance belongs to every window.
 */
export function holdingsInWindow(
  rows: AnalyticsCacheRow[],
  window: DateWindow,
  entityId?: string,
): Holding[] {
  const byGroup = new Map<string, Holding>();
  const dividendsBefore = new Map<string, number>();

  for (const r of rows) {
    if (entityId && r.entity_id !== entityId) continue;
    if (window.to && r.trade_date && r.trade_date > window.to) continue;

    const key = `${r.entity_id}__${r.share_id}`;

    if (window.from && r.trade_date && r.trade_date < window.from) {
      dividendsBefore.set(key, num(r.cum_dividend));
    }

    // Last row wins: rows arrive in compute order, so this is the closing state.
    byGroup.set(key, {
      entityId: r.entity_id,
      shareId: r.share_id,
      entityName: r.entity_name,
      ticker: r.share_ticker,
      shareName: r.share_name,
      held: num(r.share_cum_bal),
      cost: num(r.av_cost),
      marketValue: num(r.market_value),
      dividends: num(r.cum_dividend) - (dividendsBefore.get(key) ?? 0),
    });
  }

  return Array.from(byGroup.values());
}

/** Only positions still open. A closed position has no place in an allocation. */
export function openPositions(holdings: Holding[]): Holding[] {
  return holdings.filter(h => h.held > 0);
}

/** True when the batch belongs to this fingerprint and has anything in it. */
export function isFresh(rows: AnalyticsCacheRow[], sourceHash: string): boolean {
  return rows.length > 0 && rows[0].source_hash === sourceHash;
}
