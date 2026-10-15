/**
 * What a Share Analytics export contains.
 *
 * Both files this screen produces are built here — the per-holding breakdown
 * behind the download icon, and the whole-list summary behind the Export button.
 * They lived inline in the page, which is how the breakdown's two footer rows
 * came to be written one column short: the header list said seventeen columns,
 * the data rows supplied sixteen, and the footer rows supplied fourteen, so from
 * "Sale Cost" rightwards every closing figure sat under the wrong heading.
 *
 * Nothing here can drift that way again, because a row is assembled by column
 * *name* and projected through the header list at the end. A cell nobody set is
 * empty; a name that is not a column is a type error.
 *
 * Cells carry their kind (money, price, count, rate); `lib/exportTable` formats them.
 *
 * No React, no Supabase, no clock — `asOf` is passed in so the same inputs
 * always produce the same file.
 */

import {
  avPriceOrNull,
  closingRows,
  groupAerPercent,
  holdingRow,
  holdingSummary,
  marketPricePerShareAfterFees,
  saleCosts,
  type ComputedRow,
  type ShareGroup,
} from './shareLedger.service';
import {
  count,
  money,
  percent,
  price,
  type ExportCell,
  type ExportTable,
} from '../lib/exportTable';
import { activityRows } from './shareWindow.service';

/**
 * Nothing recorded is an empty cell, never a zero.
 *
 * A holding with no market price has no after-fee price and no AER. Writing 0.00
 * would claim a figure nobody stated — the same mistake as rendering a missing
 * balance as zero on screen. Empty is how a file says "no value"; Excel leaves
 * the cell blank and it stays out of a SUM.
 */
const orBlank = (n: number | null | undefined, fmt: (v: number) => ExportCell): ExportCell =>
  n == null ? null : fmt(n);

// ── Per-holding breakdown ────────────────────────────────────────────────────

/*
  The columns of the breakdown file, in order.

  Entity Name, Share and Share Name lead and repeat on every row: stacking two
  exports in one sheet has to leave each row saying what it belongs to. The three
  market figures trail and repeat for the same reason — they describe the holding
  rather than the event, and a pivot over a column that only appears on one row
  is not worth having.

  `Note` is deliberately absent. On screen it is a button that expands a contract
  note, not a value; it was in the header list with nothing ever written under
  it, which is what made the off-by-one hard to see.
*/
const DETAIL_COLUMNS = [
  'Entity Name',
  'Share',
  'Share Name',
  'Date',
  'Status',
  'Unit Price',
  'No. of Shares',
  'Share Cum Bal',
  'Purchase Cost',
  'Sale Value',
  'Sale Cost',
  'Av Cost',
  'Av Price',
  'Dividend',
  'Market Value',
  'Cash Flow +/-',
  'Total Surplus',
  'Cum Surplus',
  'CDS Account',
  'Mkt Price per Share',
  'Mkt Price Date',
  'Mkt Price after Fees per Share',
  'AER (XIRR) %',
] as const;

type DetailColumn = (typeof DETAIL_COLUMNS)[number];
type DetailRow = Partial<Record<DetailColumn, ExportCell>>;

/** A named row laid out in header order. Unset columns are empty. */
const projectDetail = (row: DetailRow): ExportCell[] =>
  DETAIL_COLUMNS.map(c => row[c] ?? null);

/**
 * The breakdown for one holding: one row per event, then the two closing rows
 * the screen shows in its footer.
 *
 * @param asOf the instant the AER discounts to — passed in rather than read
 *             from the clock so this can be asserted
 * @param from the screen's From date: event rows on or after it; blank for all
 */
export function detailExport(group: ShareGroup, asOf: Date, from = ''): ExportTable {
  const aer = groupAerPercent(group, asOf);
  const afterFees = marketPricePerShareAfterFees(group);
  const priced = group.market_price > 0;

  /** The holding's own facts, repeated on every row of the file. */
  const identity: DetailRow = {
    'Entity Name': group.entity_name,
    'Share': group.share_ticker,
    'Share Name': group.share_name,
    'Mkt Price per Share': priced ? price(group.market_price) : null,
    'Mkt Price Date': group.market_price_date ?? null,
    'Mkt Price after Fees per Share': orBlank(afterFees, price),
    'AER (XIRR) %': orBlank(aer, percent),
  };

  const costs = saleCosts(group);
  const rows: ExportCell[][] = activityRows(group, from).map((r: ComputedRow) =>
    projectDetail({
      ...identity,
      'Date': r.trade_date ?? null,
      'Status': r.note_type,
      'Unit Price': r.price_avg != null ? price(r.price_avg) : null,
      'No. of Shares': r.no_of_shares > 0 ? count(r.no_of_shares) : null,
      'Share Cum Bal': count(r.share_cum_bal),
      'Purchase Cost': r.purchase_cost > 0 ? money(r.purchase_cost) : null,
      'Sale Value': r.sale_value > 0 ? money(r.sale_value) : null,
      // What the shares sold had been carried at, which is the figure the
      // realised surplus is measured against. `saleCosts`, as the screen reads.
      'Sale Cost': orBlank(costs.get(r), money),
      'Av Cost': money(r.av_cost),
      'Av Price': orBlank(avPriceOrNull(r), money),
      'Dividend': r.dividend > 0 ? money(r.dividend) : null,
      /*
        Blank, deliberately.

        A market value per transaction is a number nobody asked this report for:
        it restates today's price against a historic balance, so a row from 2021
        reads as though it were worth that on the day. The screen has always
        shown an em dash here; the file was the only place it appeared. The two
        closing rows below carry the market value, which is where it means
        something.
      */
      'Market Value': null,
      'Cash Flow +/-': r.cash_flow !== 0 ? money(r.cash_flow) : null,
      'Total Surplus': r.cash_flow !== 0 ? money(r.cash_flow) : null,
      'Cum Surplus': money(r.cum_surplus),
      'CDS Account': r.cds_account ?? null,
    }),
  );

  // The two closing rows come from `closingRows`, which the screen's footer
  // draws from too. They used to be rebuilt here out of the same parts, and the
  // two copies disagreed on the sale value, the cash flow, the total surplus and
  // the cumulative surplus.
  for (const c of closingRows(group)) {
    rows.push(projectDetail({
      ...identity,
      'Date': c.date ?? null,
      'Status': c.label,
      'Unit Price': price(c.unitPrice),
      'No. of Shares': count(c.shares),
      'Share Cum Bal': orBlank(c.shareCumBal, count),
      'Purchase Cost': orBlank(c.purchaseCost, money),
      'Sale Value': money(c.saleValue),
      'Sale Cost': orBlank(c.saleCost, money),
      'Av Cost': money(c.avCost),
      'Av Price': orBlank(c.avPrice, money),
      'Dividend': orBlank(c.dividend, money),
      'Market Value': money(c.marketValue),
      'Cash Flow +/-': money(c.cashFlow),
      'Total Surplus': money(c.totalSurplus),
      'Cum Surplus': money(c.cumSurplus),
    }));
  }

  return { preamble: summaryBlock(group, asOf), headers: [...DETAIL_COLUMNS], rows };
}

/*
  The figures across the top of the breakdown, as a labelled block above the
  table (bug-48). Read from `holdingSummary`, the same object the modal header
  draws, so the file's Cum Surplus cannot come out different from the screen's.
  An unpriced holding leaves its market cells empty rather than writing zero.
*/
function summaryBlock(group: ShareGroup, asOf: Date): ExportCell[][] {
  const s = holdingSummary(group, asOf);
  if (!s) return [];
  return [
    ['Share', 'Entity Name', 'Shares Held', 'Av Price', 'Market Price', 'Market Price Date',
     'MV After Fees Per Share', 'Cum Surplus', 'AER (XIRR) %'],
    [
      group.share_ticker,
      group.entity_name,
      count(s.sharesHeld),
      orBlank(s.avPrice, money),
      orBlank(s.marketPrice, money),
      s.marketPriceDate ?? null,
      orBlank(s.mvAfterFeesPerShare, money),
      money(s.cumSurplus),
      orBlank(s.aerPercent, percent),
    ],
    [],
  ];
}

/** `TICKER_Entity_analytics_2026-09-21` -- the format adds `.xlsx` or `.csv`. */
export function detailFilename(group: ShareGroup, asOf: Date): string {
  const date = asOf.toISOString().split('T')[0];
  return `${group.share_ticker}_${group.entity_name}_analytics_${date}`;
}

// ── Whole-list summary ───────────────────────────────────────────────────────

const SUMMARY_COLUMNS = [
  'Share',
  'Share Name',
  'Entity Name',
  'CDS Accounts',
  'Share Cum Bal',
  'Purchase Cost',
  'Sale Value',
  'Av Cost',
  'Av Price',
  'Dividend',
  'Cum Surplus',
  'Market Value',
  'MV after Fees',
  'Cash Flow',
  'Total Surplus',
  'Mkt Price per Share',
  'Mkt Price Date',
  'Mkt Price after Fees per Share',
  'AER (XIRR) %',
] as const;

type SummaryColumn = (typeof SUMMARY_COLUMNS)[number];

const projectSummary = (row: Partial<Record<SummaryColumn, ExportCell>>): ExportCell[] =>
  SUMMARY_COLUMNS.map(c => row[c] ?? null);

/**
 * One row per holding.
 *
 * The same four market columns the breakdown gained. They were missing here too:
 * the file carried "MV after Fees" as a total but never the per-share price it
 * came from, so a reader could not check it, and never the AER at all.
 *
 * @param activityRows a holding's rows inside the date window (`shareWindow.service`).
 */
export function summaryExport(
  groups: ShareGroup[],
  activityRows: (group: ShareGroup) => ComputedRow[],
  asOf: Date,
): ExportTable {
  const rows = groups.map(g => {
    const afterFees = marketPricePerShareAfterFees(g);
    const priced = g.market_price > 0;
    // The same row the screen draws, so the file cannot disagree with it. This
    // wrote the ledger's before-fee `total_surplus`, as the screen did (bug-50).
    const h = g.rows.length > 0 ? holdingRow(g, activityRows(g)) : null;

    return projectSummary({
      'Share': g.share_ticker,
      'Share Name': g.share_name,
      'Entity Name': g.entity_name,
      'CDS Accounts': g.cds_accounts.join('; '),
      'Share Cum Bal': h ? count(h.shareCumBal) : null,
      'Purchase Cost': h ? money(h.purchaseCost) : null,
      'Sale Value': h ? money(h.saleValue) : null,
      'Av Cost': h ? money(h.avCost) : null,
      'Av Price': orBlank(h?.avPrice, money),
      'Dividend': h ? money(h.dividend) : null,
      'Cum Surplus': h ? money(h.cumSurplus) : null,
      'Market Value': orBlank(h?.marketValue, money),
      'MV after Fees': orBlank(h?.mvAfterFees, money),
      'Cash Flow': h ? money(h.cashFlow) : null,
      'Total Surplus': orBlank(h?.totalSurplus, money),
      'Mkt Price per Share': priced ? price(g.market_price) : null,
      'Mkt Price Date': g.market_price_date ?? null,
      'Mkt Price after Fees per Share': orBlank(afterFees, price),
      'AER (XIRR) %': orBlank(groupAerPercent(g, asOf), percent),
    });
  });

  return { headers: [...SUMMARY_COLUMNS], rows };
}

/** `share_analytics_<entity or all>_2026-09-21` -- the format adds the extension. */
export function summaryFilename(label: string, asOf: Date): string {
  return `share_analytics_${label}_${asOf.toISOString().split('T')[0]}`;
}
