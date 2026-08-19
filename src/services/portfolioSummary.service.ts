/**
 * Builds the Portfolio Summary report from cached analytics rows, for a date
 * window.
 *
 * Shares `analyticsCache.repo` and the window rule with
 * `portfolioHoldings.service` — this report needs more columns and a per-share
 * AER, so it gets its own service rather than a wider `Holding`.
 *
 * No React and no Supabase: rows in, report rows out.
 */

import type { AnalyticsCacheRow } from '../repositories/analyticsCache.repo';
import type { CashFlow, AerPosition } from '../lib/aer';
import type { DateWindow } from './portfolioHoldings.service';

export interface SummaryRow {
  entityId: string;
  shareId: string;
  entityName: string;
  ticker: string;
  shareName: string;
  cdsAccounts: string[];
  balanceShares: number;
  /** Average cost of the shares still held, as at the window's end. */
  cost: number;
  costPerShare: number;
  marketPricePerShare: number;
  /** Market value less brokerage. */
  marketValueNet: number;
  /** Dividends within the window — see `windowedDividends`. */
  div: number;
  /** Since acquisition, as at the window's end. Never period-scoped: see below. */
  totalReturns: number;
  /** Per-share XIRR as cached, or null when none solves. */
  aer: number | null;
}

export interface SummaryResult {
  rows: SummaryRow[];
  /** Positions for a pooled portfolio AER, in `lib/aer` terms. */
  aerPositions: AerPosition[];
}

const num = (v: number | string | null | undefined): number => Number(v) || 0;

/**
 * The end date truncates history; the start date does not.
 *
 * Identical reasoning to `portfolioHoldings.service`: every row carries the
 * cumulative state after it, so ignoring rows traded after the end date leaves
 * the last surviving row holding the position as it stood that day. Hiding rows
 * *before* a start date would remove the purchases the balance and average cost
 * are built from.
 *
 * **`totalReturns` is deliberately not period-scoped.** It includes the market
 * value of what is still held, so it only means anything measured from
 * acquisition. Scoping it to a period would need the position's value at the
 * start of that period, which needs a historic price per as-of date — see the
 * limitation noted on the report. `div` *is* period-scoped, because dividends
 * accumulate and subtracting an earlier running total is exact. Callers must say
 * which column means what; the two disagree by design when a start date is set.
 */
export function summaryInWindow(
  rows: AnalyticsCacheRow[],
  window: DateWindow,
  entityId?: string,
): SummaryResult {
  interface Acc {
    row: AnalyticsCacheRow;
    dividendsBefore: number;
    cashFlows: CashFlow[];
  }

  const groups = new Map<string, Acc>();

  for (const r of rows) {
    if (entityId && r.entity_id !== entityId) continue;
    if (window.to && r.trade_date && r.trade_date > window.to) continue;

    const key = `${r.entity_id}__${r.share_id}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = { row: r, dividendsBefore: 0, cashFlows: [] };
      groups.set(key, acc);
    }

    if (window.from && r.trade_date && r.trade_date < window.from) {
      acc.dividendsBefore = num(r.cum_dividend);
    }

    const flow = num(r.cash_flow);
    if (flow !== 0 && r.trade_date) {
      acc.cashFlows.push({ date: new Date(r.trade_date + 'T00:00:00'), amount: flow });
    }

    // Rows arrive in compute order, so the last one seen is the closing state.
    acc.row = r;
  }

  const result: SummaryResult = { rows: [], aerPositions: [] };

  for (const acc of groups.values()) {
    const r = acc.row;
    const held = num(r.share_cum_bal);
    const marketPrice = num(r.market_price);
    const feeRate = num(r.brokerage_fee_rate);

    // Every position, held or exited, belongs in the portfolio AER: a closed
    // position's cash flows are complete and are part of the return.
    result.aerPositions.push({
      label: r.share_ticker || 'N/A',
      cashFlows: acc.cashFlows,
      heldShares: held,
      marketPrice,
      brokerageFeeRate: feeRate,
    });

    // The report lists current holdings only.
    if (held <= 0) continue;

    const marketValueNet = num(r.market_value) * (1 - feeRate / 100);
    const cumDividend = num(r.cum_dividend);

    result.rows.push({
      entityId: r.entity_id,
      shareId: r.share_id,
      entityName: r.entity_name,
      ticker: r.share_ticker || 'N/A',
      shareName: r.share_name || 'N/A',
      cdsAccounts: r.cds_accounts ?? [],
      balanceShares: held,
      cost: num(r.av_cost),
      costPerShare: held > 0 ? num(r.av_cost) / held : 0,
      marketPricePerShare: marketPrice,
      marketValueNet,
      div: cumDividend - acc.dividendsBefore,
      totalReturns:
        marketValueNet + num(r.cum_sale_value) + cumDividend - num(r.cum_purchase_cost),
      aer: r.aer != null ? Number(r.aer) : null,
    });
  }

  result.rows.sort(
    (a, b) => a.entityName.localeCompare(b.entityName) || a.ticker.localeCompare(b.ticker),
  );
  return result;
}
