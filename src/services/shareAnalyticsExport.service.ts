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
 * No React, no Supabase, no clock — `asOf` is passed in so the same inputs
 * always produce the same file.
 */

import {
  groupAerPercent,
  marketPricePerShareAfterFees,
  type ComputedRow,
  type ShareGroup,
} from './shareLedger.service';

export type Cell = string | number;

export interface CsvTable {
  headers: string[];
  rows: Cell[][];
}

/**
 * Money and prices are written as fixed strings, not numbers.
 *
 * Excel parses "125734153.89" into a number either way, and a fixed string stops
 * a float's 8th decimal place turning up in a cell that is stated to the cent.
 */
const money = (n: number) => n.toFixed(2);
const price = (n: number) => n.toFixed(4);

/**
 * Nothing recorded is an empty cell, never a zero.
 *
 * A holding with no market price has no after-fee price and no AER. Writing 0.00
 * would claim a figure nobody stated — the same mistake as rendering a missing
 * balance as zero on screen. Empty is how a CSV says "no value"; Excel leaves
 * the cell blank and it stays out of a SUM.
 */
const orBlank = (n: number | null | undefined, fmt: (v: number) => string): Cell =>
  n == null ? '' : fmt(n);

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
type DetailRow = Partial<Record<DetailColumn, Cell>>;

/** A named row laid out in header order. Unset columns are empty. */
const projectDetail = (row: DetailRow): Cell[] =>
  DETAIL_COLUMNS.map(c => row[c] ?? '');

/**
 * The breakdown for one holding: one row per event, then the two closing rows
 * the screen shows in its footer.
 *
 * @param asOf the instant the AER discounts to, and the date stamped on the
 *             Market Value row — passed in rather than read from the clock so
 *             this can be asserted
 */
export function detailExport(group: ShareGroup, asOf: Date): CsvTable {
  const last = group.rows[group.rows.length - 1];
  const aer = groupAerPercent(group, asOf);
  const afterFees = marketPricePerShareAfterFees(group);
  const priced = group.market_price > 0;

  /** The holding's own facts, repeated on every row of the file. */
  const identity: DetailRow = {
    'Entity Name': group.entity_name,
    'Share': group.share_ticker,
    'Share Name': group.share_name,
    'Mkt Price per Share': priced ? price(group.market_price) : '',
    'Mkt Price Date': group.market_price_date ?? '',
    'Mkt Price after Fees per Share': orBlank(afterFees, price),
    'AER (XIRR) %': orBlank(aer, v => v.toFixed(2)),
  };

  const rows: Cell[][] = group.rows.map((r: ComputedRow) =>
    projectDetail({
      ...identity,
      'Date': r.trade_date ?? '',
      'Status': r.note_type,
      'Unit Price': r.price_avg != null ? price(r.price_avg) : '',
      'No. of Shares': r.no_of_shares > 0 ? r.no_of_shares : '',
      'Share Cum Bal': r.share_cum_bal,
      'Purchase Cost': r.purchase_cost > 0 ? money(r.purchase_cost) : '',
      'Sale Value': r.sale_value > 0 ? money(r.sale_value) : '',
      // What the shares sold had been carried at, which is the figure the
      // realised surplus is measured against.
      'Sale Cost': r.row_type === 'sell' && r.no_of_shares > 0
        ? money(r.no_of_shares * r.av_price)
        : '',
      'Av Cost': money(r.av_cost),
      'Av Price': money(r.av_price),
      'Dividend': r.dividend > 0 ? money(r.dividend) : '',
      'Market Value': priced ? money(r.market_value) : '',
      'Cash Flow +/-': r.cash_flow !== 0 ? money(r.cash_flow) : '',
      'Total Surplus': r.cash_flow !== 0 ? money(r.cash_flow) : '',
      'Cum Surplus': money(r.cum_surplus),
      'CDS Account': r.cds_account ?? '',
    }),
  );

  // The two closing rows only mean anything once a price is known. Testing
  // `afterFees` rather than `priced` is what narrows it to a number — coercing a
  // null away with `?? 0` here would be the gap-filling this file exists to
  // avoid, even where a guard happens to make it unreachable.
  if (last && afterFees != null) {
    const mvAfterFees = afterFees * last.share_cum_bal;
    const totalPC = group.rows.reduce((s, r) => s + r.purchase_cost, 0);
    const totalSV = group.rows.reduce((s, r) => s + r.sale_value, 0);

    rows.push(projectDetail({
      ...identity,
      'Date': asOf.toISOString().split('T')[0],
      'Status': 'Market Value',
      'Unit Price': price(group.market_price),
      'No. of Shares': last.share_cum_bal,
      'Share Cum Bal': last.share_cum_bal,
      'Sale Value': money(mvAfterFees),
      'Av Cost': money(last.av_cost),
      'Av Price': money(last.av_price),
      'Market Value': money(mvAfterFees),
      'Cash Flow +/-': money(mvAfterFees),
      'Total Surplus': money(mvAfterFees),
      'Cum Surplus': money(mvAfterFees),
    }));

    const totalSharesBought = group.rows
      .filter(r => r.row_type === 'buy' || r.row_type === 'opening' || r.row_type === 'scrip')
      .reduce((s, r) => s + r.no_of_shares, 0);
    const costPerShare = totalSharesBought > 0 ? totalPC / totalSharesBought : 0;

    rows.push(projectDetail({
      ...identity,
      'Status': 'Cost per share',
      'Unit Price': price(costPerShare),
      'No. of Shares': totalSharesBought,
      'Purchase Cost': money(totalPC),
      'Sale Value': money(totalSV),
      'Av Cost': money(last.av_cost),
      'Av Price': money(last.av_price),
      'Market Value': money(mvAfterFees),
      'Cash Flow +/-': money(mvAfterFees),
      'Total Surplus': money(mvAfterFees),
      'Cum Surplus': money(mvAfterFees),
    }));
  }

  return { headers: [...DETAIL_COLUMNS], rows };
}

/** `TICKER_Entity_analytics_2026-09-21.csv` */
export function detailFilename(group: ShareGroup, asOf: Date): string {
  const date = asOf.toISOString().split('T')[0];
  return `${group.share_ticker}_${group.entity_name}_analytics_${date}.csv`;
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

const projectSummary = (row: Partial<Record<SummaryColumn, Cell>>): Cell[] =>
  SUMMARY_COLUMNS.map(c => row[c] ?? '');

/**
 * One row per holding.
 *
 * The same four market columns the breakdown gained. They were missing here too:
 * the file carried "MV after Fees" as a total but never the per-share price it
 * came from, so a reader could not check it, and never the AER at all.
 *
 * @param activityRows the rows of the holding that fall inside the report's date
 *                     window. The page owns the window; the totals below are
 *                     sums over whatever it hands in.
 */
export function summaryExport(
  groups: ShareGroup[],
  activityRows: (group: ShareGroup) => ComputedRow[],
  asOf: Date,
): CsvTable {
  const rows = groups.map(g => {
    const last = g.rows[g.rows.length - 1];
    const act = activityRows(g);
    const afterFees = marketPricePerShareAfterFees(g);
    const priced = g.market_price > 0;
    const sum = (pick: (r: ComputedRow) => number) => act.reduce((s, r) => s + pick(r), 0);

    return projectSummary({
      'Share': g.share_ticker,
      'Share Name': g.share_name,
      'Entity Name': g.entity_name,
      'CDS Accounts': g.cds_accounts.join('; '),
      'Share Cum Bal': last ? last.share_cum_bal : '',
      'Purchase Cost': money(sum(r => r.purchase_cost)),
      'Sale Value': money(sum(r => r.sale_value)),
      'Av Cost': last ? money(last.av_cost) : '',
      'Av Price': last ? money(last.av_price) : '',
      'Dividend': money(sum(r => r.dividend)),
      'Cum Surplus': last ? money(last.cum_surplus) : '',
      'Market Value': priced && last ? money(last.market_value) : '',
      'MV after Fees': last && afterFees != null ? money(afterFees * last.share_cum_bal) : '',
      'Cash Flow': money(sum(r => r.cash_flow)),
      'Total Surplus': priced && last ? money(last.total_surplus) : '',
      'Mkt Price per Share': priced ? price(g.market_price) : '',
      'Mkt Price Date': g.market_price_date ?? '',
      'Mkt Price after Fees per Share': orBlank(afterFees, price),
      'AER (XIRR) %': orBlank(groupAerPercent(g, asOf), v => v.toFixed(2)),
    });
  });

  return { headers: [...SUMMARY_COLUMNS], rows };
}
