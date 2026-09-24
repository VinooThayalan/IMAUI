/**
 * The two ledger reports on the Reports screen, projected from the one ledger.
 *
 * Both used to replay `transactions` themselves. Neither read scrip, the summary
 * valued what was held before fees, and the detailed report kept one running
 * "Cum Surplus" across every holding in the book, so no figure in its column
 * described the row it sat on. On the live data every one of the 36 holdings
 * disagreed with Share Analytics; HNB.X0000 read 520,792,567.99 against
 * 519,220,201.41.
 *
 * They now take `ShareGroup`s from `shareGroups.service` and read every closing
 * figure through `shareLedger.service`, so a holding reports the same number
 * here as in its Share Analytics breakdown and export.
 *
 * No React, no Supabase.
 */

import {
  closingCumSurplus,
  closingRows,
  groupAerPercent,
  marketPricePerShareAfterFees,
  type ShareGroup,
} from './shareLedger.service';

// ── Share Analytics Report: one row per holding ─────────────────────────────

export interface AnalyticsReportRow {
  entity_name: string;
  ticker: string;
  share_name: string;
  share_cum_bal: number;
  purchase_cost: number;
  sale_value: number;
  /** Average cost per share of what is still held. */
  av_price: number;
  dividend: number;
  /** Sale value + dividend - purchase cost: what the holding has realised. */
  cash_flow: number;
  /** What the shares held would fetch, net of brokerage. Null when unpriced. */
  mv_after_fees: number | null;
  /**
   * Realised surplus plus `mv_after_fees` -- the figure the Share Analytics
   * header shows as Cum Surplus. Realised only when the holding is unpriced.
   */
  cum_surplus: number;
}

export function analyticsReport(groups: ShareGroup[]): AnalyticsReportRow[] {
  const rows: AnalyticsReportRow[] = [];
  for (const g of groups) {
    const last = g.rows[g.rows.length - 1];
    const cumSurplus = closingCumSurplus(g);
    if (!last || cumSurplus == null) continue;
    const perShare = marketPricePerShareAfterFees(g);
    rows.push({
      entity_name: g.entity_name,
      ticker: g.share_ticker,
      share_name: g.share_name,
      share_cum_bal: last.share_cum_bal,
      purchase_cost: last.cum_purchase_cost,
      sale_value: last.cum_sale_value,
      av_price: last.av_price,
      dividend: last.cum_dividend,
      cash_flow: last.cum_surplus,
      mv_after_fees: perShare == null ? null : perShare * last.share_cum_bal,
      cum_surplus: cumSurplus,
    });
  }
  return rows;
}

// ── Detailed Share Report: every event, then each holding's closing row ─────

export interface DetailedReportRow {
  entity_name: string;
  share_ticker: string;
  date: string | null;
  /** Buy, Sell, Dividend, Scrip, Opening -- or 'Market Value' on a closing row. */
  status: string;
  closing: boolean;
  unit_price: number | null;
  no_of_shares: number | null;
  share_cum_bal: number;
  purchase_cost: number | null;
  sale_value: number | null;
  av_price: number;
  dividend: number | null;
  /** Only on the closing row: a market value per event would restate today's price against a past balance. */
  market_value: number | null;
  cash_flow: number | null;
  /** This holding's cumulative surplus -- realised on an event, closing on the closing row. */
  cum_surplus: number;
  cds_account: string;
  market_price: number | null;
  mv_after_fees_per_share: number | null;
  aer: number | null;
}

export interface DetailedReport {
  rows: DetailedReportRow[];
  /** Events listed, not counting closing rows. */
  eventCount: number;
  /** Sum of each listed holding's closing Cum Surplus. */
  totalCumSurplus: number;
}

/**
 * @param window `to` truncates each holding's history -- the last row left is
 *               the position as it stood that day. `from` only filters which
 *               events are listed: the position is still built from everything
 *               before it. The same rule Share Analytics applies.
 * @param asOf   the instant AER discounts to
 */
export function detailedReport(
  groups: ShareGroup[],
  window: { from: string; to: string },
  asOf: Date,
): DetailedReport {
  const rows: DetailedReportRow[] = [];
  let eventCount = 0;
  let totalCumSurplus = 0;

  for (const full of groups) {
    const g = window.to
      ? { ...full, rows: full.rows.filter(r => !r.trade_date || r.trade_date <= window.to) }
      : full;
    if (g.rows.length === 0) continue;

    const listed = window.from
      ? g.rows.filter(r => r.trade_date && r.trade_date >= window.from)
      : g.rows;
    if (listed.length === 0) continue;

    const priced = g.market_price > 0 ? g.market_price : null;
    const afterFees = marketPricePerShareAfterFees(g);
    const aer = groupAerPercent(g, asOf);
    const cds = g.cds_accounts.join(', ');

    for (const r of listed) {
      eventCount++;
      rows.push({
        entity_name: g.entity_name,
        share_ticker: g.share_ticker,
        date: r.trade_date,
        status: r.note_type,
        closing: false,
        unit_price: r.price_avg,
        no_of_shares: r.no_of_shares > 0 ? r.no_of_shares : null,
        share_cum_bal: r.share_cum_bal,
        purchase_cost: r.purchase_cost > 0 ? r.purchase_cost : null,
        sale_value: r.sale_value > 0 ? r.sale_value : null,
        av_price: r.av_price,
        dividend: r.dividend > 0 ? r.dividend : null,
        market_value: null,
        cash_flow: r.cash_flow !== 0 ? r.cash_flow : null,
        cum_surplus: r.cum_surplus,
        cds_account: r.cds_account ?? cds,
        market_price: priced,
        mv_after_fees_per_share: afterFees,
        aer,
      });
    }

    const mv = closingRows(g, asOf).find(c => c.label === 'Market Value');
    const cum = closingCumSurplus(g);
    if (cum != null) totalCumSurplus += cum;
    if (mv) {
      rows.push({
        entity_name: g.entity_name,
        share_ticker: g.share_ticker,
        date: mv.date,
        status: mv.label,
        closing: true,
        unit_price: mv.unitPrice,
        no_of_shares: mv.shares,
        share_cum_bal: mv.shares,
        purchase_cost: null,
        sale_value: null,
        av_price: mv.avPrice,
        dividend: null,
        market_value: mv.marketValue,
        cash_flow: mv.cashFlow,
        cum_surplus: mv.cumSurplus,
        cds_account: cds,
        market_price: priced,
        mv_after_fees_per_share: afterFees,
        aer,
      });
    }
  }

  return { rows, eventCount, totalCumSurplus };
}
