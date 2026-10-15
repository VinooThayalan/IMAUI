import { aerPercent, netMarketValue } from '../lib/aer';

/**
 * The share ledger: the one computation of what a holding is.
 *
 * Replays every event for one (entity, share) in order — opening balance, buys,
 * sells, dividends, scrip issues — and records the cumulative state after each.
 * Everything downstream reads those snapshots: balances, average cost, cash
 * flows for the AER, and the closing position.
 *
 * This lived inside ShareAnalytics, and the Dashboard grew a second,
 * incompatible version of the same idea against the same tables. They disagreed,
 * because the Dashboard's copy never knew about scrip issues and never filtered
 * notes by status. Four reported defects came out of that one divergence.
 *
 * Pure: no React, no Supabase, no clock. Sources in, snapshots out.
 */

export interface OpeningBalance {
  entity_id: string;
  share_id: string;
  opening_shares: number;
  average_purchase_cost: number;
  effective_date: string;
}

export interface DividendRecord {
  entity_id: string;
  share_id: string;
  payment_date: string | null;
  amount_net: number;
}

export interface ScripRecord {
  entity_id: string;
  share_id: string;
  no_of_shares: number;
  effective_date: string | null;
  entry_date: string;
}

export interface RawNote {
  id: string;
  note_type: string;
  trade_date: string | null;
  no_of_shares: number;
  price_avg: number | null;
  gross_amount: number;
  net_amount: number;
  entity_id: string;
  entity_name: string;
  share_id: string;
  share_ticker: string;
  share_name: string;
  cds_account: string | null;
  /**
   * Stated position within this note's own trade date, 1-based, or null when
   * nobody has stated one. See `sortNotes` — null is "unstated", not "first".
   */
  intraday_seq?: number | null;
}

export interface ComputedRow extends RawNote {
  row_type: 'opening' | 'buy' | 'sell' | 'dividend' | 'scrip';
  purchase_cost: number;
  sale_value: number;
  dividend: number;
  share_cum_bal: number;
  av_cost: number;
  av_price: number;
  cum_purchase_cost: number;
  cum_sale_value: number;
  cum_dividend: number;
  cum_surplus: number;   // (cum_sale_value + cum_dividend) - cum_purchase_cost (realized only)
  market_value: number;
  cash_flow: number;
  total_surplus: number; // (market_value + cum_sale_value + cum_dividend) - cum_purchase_cost
                         // Before fees. Cached, never shown: a cell reads holdingRow().totalSurplus.
}

export interface ShareGroup {
  share_id: string;
  share_ticker: string;
  share_name: string;
  entity_id: string;
  entity_name: string;
  market_price: number;
  market_price_date: string | null;
  cds_accounts: string[];
  brokerage_fee_rate: number;
  rows: ComputedRow[];
}
/**
 * One holding's dated cash flows, in the form the AER helpers want.
 *
 * Lived in ShareAnalytics.tsx, where the CSV export could not reach it without
 * the page handing it down. Here because it belongs to `ShareGroup`, and because
 * a second copy written for the export is exactly how four AER implementations
 * came to disagree on the same holding.
 */
export function groupCashFlows(rows: ComputedRow[]): Array<{ date: Date; amount: number }> {
  return rows
    .filter(r => r.cash_flow !== 0 && r.trade_date)
    .map(r => ({ date: new Date(r.trade_date! + 'T00:00:00'), amount: r.cash_flow }));
}

/**
 * AER for a single share holding: every dated cash flow, plus the net market
 * value of whatever is still held as a terminal inflow.
 *
 * Null when there is no solution — no flows, or a series XIRR cannot discount.
 * Null, not zero: "we cannot say" is not "it returned nothing".
 */
export function groupAerPercent(group: ShareGroup, asOf: Date): number | null {
  const last = group.rows[group.rows.length - 1];
  if (!last) return null;
  const cfs = groupCashFlows(group.rows);
  const terminal = netMarketValue(last.share_cum_bal, group.market_price, group.brokerage_fee_rate);
  if (terminal > 0) cfs.push({ date: asOf, amount: terminal });
  return aerPercent(cfs);
}

/**
 * What one share is worth after the fees selling it would cost.
 *
 * `netMarketValue` for a single share rather than a second formula — the pill on
 * screen reads "MV After Fees Per Share" and must not be able to disagree with
 * the total beside it.
 *
 * Null when no market price is recorded. A share with no price is not worth
 * zero; nobody has said what it is worth.
 */
export function marketPricePerShareAfterFees(group: ShareGroup): number | null {
  if (!(group.market_price > 0)) return null;
  return netMarketValue(1, group.market_price, group.brokerage_fee_rate);
}

/**
 * A row's average price, for a cell.
 *
 * `av_price` answers 0 once nothing is held, because the ledger has to carry
 * something forward. An average over no shares is not zero, it is undefined, so
 * the cell is a dash -- ALUM.N0000's 22/07/2021 sale of all 6,990 shares read
 * 0.00 here. Delegates to `av_price`; never a second computation.
 */
export function avPriceOrNull(row: ComputedRow): number | null {
  return row.share_cum_bal > 0 ? row.av_price : null;
}

/**
 * What each sell removed from the holding's cost: the fall in `av_cost` across
 * the row. Other rows have no sale cost and are absent from the map.
 *
 * This was `no_of_shares * av_price` read off the sell row itself, on the claim
 * that a sell leaves the average where it found it. It does -- unless it empties
 * the position, when the average left behind is 0. ALUM.N0000's 22/07/2021 sale
 * of all 6,990 shares showed a cost of 0.00 against the 96,128.72 they had cost.
 * Read back from the cache it was also wrong in the cents, because `av_price` is
 * stored to four places: 100,000 ALUM shares came out at 1,649,300.00 against
 * 1,649,295.00. `av_cost` is an amount of money, so its difference is exact.
 *
 * The screen's Sale Cost column, the export's, and the Cost per share total all
 * read this.
 */
export function saleCosts(group: ShareGroup): Map<ComputedRow, number> {
  const costs = new Map<ComputedRow, number>();
  group.rows.forEach((r, i) => {
    if (r.row_type !== 'sell' || !(r.no_of_shares > 0)) return;
    const before = i > 0 ? group.rows[i - 1].av_cost : 0;
    costs.set(r, before - r.av_cost);
  });
  return costs;
}

/**
 * The two rows that close a holding's breakdown.
 *
 * The screen drew these in its `tfoot` and the CSV export built them again from
 * the same parts, and the two disagreed — on the sale value, on the cash flow,
 * on the total surplus, and on whether an event row carries a market value at
 * all. Six separate reports came out of that one divergence. They are computed
 * here now and both readers project these objects; there is no second answer to
 * disagree with.
 *
 * `null` means the cell has nothing to say — an em dash on screen, an empty cell
 * in the file. It is not zero. "Market Value" has no purchase cost because it is
 * not a purchase; "Cost per share" has no closing balance because it is a unit
 * rate, not a position.
 *
 * Empty when the holding has no market price: both rows are statements about
 * what the position is worth, and nobody has said what it is worth.
 */
export interface ClosingRow {
  label: 'Market Value' | 'Cost per share';
  /** Market Value row: the date of the price it uses. */
  date: string | null;
  unitPrice: number;
  shares: number;
  shareCumBal: number | null;
  purchaseCost: number | null;
  saleValue: number;
  saleCost: number | null;
  avCost: number;
  avPrice: number | null;
  dividend: number | null;
  /** Before fees, as the list's Market Value column. */
  marketValue: number;
  mvAfterFees: number;
  cashFlow: number;
  totalSurplus: number;
  cumSurplus: number;
}

/**
 * Realised surplus plus what the shares still held would fetch after fees.
 *
 * The one definition behind every "Cum Surplus" that closes a holding: the
 * modal header, both closing rows, and the export's summary block. The header
 * used to compute this inline and the Cost per share row repeated the market
 * value instead, so HNB.X0000 read 519,220,527.72 in one place and
 * 3,019,178,989.73 in the next row down.
 *
 * Unpriced, there is nothing held to add, and the realised figure is the answer.
 * `null` only when the holding has no rows at all.
 */
export function closingCumSurplus(group: ShareGroup): number | null {
  const last = group.rows[group.rows.length - 1];
  if (!last) return null;
  const mvAfterFees = holdingMvAfterFees(group);
  return mvAfterFees == null ? last.cum_surplus : last.cum_surplus + mvAfterFees;
}

/**
 * What the shares still held would fetch today, after fees.
 *
 * Null when no market price is recorded -- nobody has said what they are worth.
 * The list row used to inline `market_value * (1 - rate / 100)` while its Grand
 * Total called `netMarketValue`: two spellings of the figure this is.
 */
export function holdingMvAfterFees(group: ShareGroup): number | null {
  const last = group.rows[group.rows.length - 1];
  const perShareAfterFees = marketPricePerShareAfterFees(group);
  if (!last || perShareAfterFees == null) return null;
  return perShareAfterFees * last.share_cum_bal;
}

/**
 * One holding's line in the Share Analytics list, and in the summary export.
 *
 * The screen and the export each assembled this themselves, and both read Total
 * Surplus from the ledger's `total_surplus` -- realised surplus plus the market
 * value *before* fees -- while the breakdown behind the same row closes on
 * `closingCumSurplus`, after fees. bug-50: AHUN.N0000 read 1,729,296.11 on the
 * list and 301,705.47 inside it, the difference being exactly its fees. Built
 * once here; the row, the Grand Total and the export all project it.
 *
 * Two grains, kept apart on purpose. The activity columns sum `activity`, the
 * rows the page's From date lets through. The position columns -- Total Surplus
 * among them -- are the closing state since acquisition: a From date scopes what
 * happened in a period, not what a position is worth.
 *
 * `null` is a figure nobody stated: no market price, no market value and no
 * Total Surplus, and the cell is a dash.
 *
 * The group must hold at least one row. Every group the ledger builds does.
 */
export interface HoldingRow {
  shareCumBal: number;
  purchaseCost: number;
  saleValue: number;
  dividend: number;
  cashFlow: number;
  txnCount: number;
  avCost: number;
  avPrice: number | null;
  cumSurplus: number;
  marketValue: number | null;
  mvAfterFees: number | null;
  totalSurplus: number | null;
}

export function holdingRow(group: ShareGroup, activity: ComputedRow[]): HoldingRow {
  const last = group.rows[group.rows.length - 1];
  const sum = (pick: (r: ComputedRow) => number) => activity.reduce((s, r) => s + pick(r), 0);
  const mvAfterFees = holdingMvAfterFees(group);
  return {
    shareCumBal: last.share_cum_bal,
    purchaseCost: sum(r => r.purchase_cost),
    saleValue: sum(r => r.sale_value),
    dividend: sum(r => r.dividend),
    cashFlow: sum(r => r.cash_flow),
    txnCount: activity.filter(r => r.row_type === 'buy' || r.row_type === 'sell' || r.row_type === 'scrip').length,
    avCost: last.av_cost,
    avPrice: avPriceOrNull(last),
    cumSurplus: last.cum_surplus,
    marketValue: mvAfterFees == null ? null : last.market_value,
    mvAfterFees,
    totalSurplus: mvAfterFees == null ? null : closingCumSurplus(group),
  };
}

/**
 * The Grand Total under the list: every column the sum of the rows above it.
 *
 * It used to compute Total Surplus a second way -- after-fee market value plus
 * the *period's* purchases, sales and dividends. Unwindowed that agreed with the
 * rows' after-fee sum; with a From date it left out what the held shares cost
 * and kept what they are worth, and read 10.47bn against 1.33bn of rows.
 *
 * A dash adds nothing: the total across holdings is the sum of those that have
 * a figure, and theirs keep their dashes. Av Price has no total -- a sum of
 * averages is not an average.
 */
export type HoldingTotals = { [K in Exclude<keyof HoldingRow, 'avPrice'>]: number };

export function holdingTotals(rows: HoldingRow[]): HoldingTotals {
  const total = (pick: (r: HoldingRow) => number | null) =>
    rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
  return {
    shareCumBal: total(r => r.shareCumBal),
    purchaseCost: total(r => r.purchaseCost),
    saleValue: total(r => r.saleValue),
    dividend: total(r => r.dividend),
    cashFlow: total(r => r.cashFlow),
    txnCount: total(r => r.txnCount),
    avCost: total(r => r.avCost),
    cumSurplus: total(r => r.cumSurplus),
    marketValue: total(r => r.marketValue),
    mvAfterFees: total(r => r.mvAfterFees),
    totalSurplus: total(r => r.totalSurplus),
  };
}

/**
 * The figures across the top of a holding's breakdown.
 *
 * Built here so the modal header and the export's summary block read the same
 * object. `null` is a figure nobody stated -- no market price means no after-fee
 * price and no AER -- and renders as a dash or an empty cell, never as zero.
 */
export interface HoldingSummary {
  sharesHeld: number;
  avPrice: number | null;
  marketPrice: number | null;
  marketPriceDate: string | null;
  mvAfterFeesPerShare: number | null;
  cumSurplus: number;
  aerPercent: number | null;
}

export function holdingSummary(group: ShareGroup, asOf: Date): HoldingSummary | null {
  const last = group.rows[group.rows.length - 1];
  const cumSurplus = closingCumSurplus(group);
  if (!last || cumSurplus == null) return null;
  return {
    sharesHeld: last.share_cum_bal,
    avPrice: avPriceOrNull(last),
    marketPrice: group.market_price > 0 ? group.market_price : null,
    marketPriceDate: group.market_price > 0 ? group.market_price_date : null,
    mvAfterFeesPerShare: marketPricePerShareAfterFees(group),
    cumSurplus,
    aerPercent: groupAerPercent(group, asOf),
  };
}

export function closingRows(group: ShareGroup): ClosingRow[] {
  const last = group.rows[group.rows.length - 1];
  const mvAfterFees = holdingMvAfterFees(group);
  const cumSurplus = closingCumSurplus(group);
  if (!last || mvAfterFees == null || cumSurplus == null) return [];

  const totalPurchase = group.rows.reduce((s, r) => s + r.purchase_cost, 0);
  const totalSale     = group.rows.reduce((s, r) => s + r.sale_value, 0);
  const totalDividend = group.rows.reduce((s, r) => s + r.dividend, 0);
  const totalCashFlow = group.rows.reduce((s, r) => s + r.cash_flow, 0);

  // What the shares sold had been carried at: the sum of the Sale Cost column
  // above it, from the same `saleCosts`, so the total cannot disagree with it.
  let totalSaleCost = 0;
  for (const cost of saleCosts(group).values()) totalSaleCost += cost;

  // Cost per share divides what was paid by everything that arrived, bought or
  // free: scrip shares cost nothing and still dilute the rate.
  const sharesAcquired = group.rows
    .filter(r => r.row_type === 'buy' || r.row_type === 'opening' || r.row_type === 'scrip')
    .reduce((s, r) => s + r.no_of_shares, 0);
  const costPerShare = sharesAcquired > 0 ? totalPurchase / sharesAcquired : 0;

  return [
    {
      label: 'Market Value',
      date: group.market_price_date,
      unitPrice: group.market_price,
      shares: last.share_cum_bal,
      shareCumBal: last.share_cum_bal,
      purchaseCost: null,
      saleValue: mvAfterFees,
      saleCost: null,
      avCost: last.av_cost,
      avPrice: avPriceOrNull(last),
      dividend: null,
      marketValue: last.market_value,
      mvAfterFees,
      cashFlow: mvAfterFees,
      totalSurplus: mvAfterFees,
      /*
        Realised surplus plus what is still held, which is the figure the modal
        header already shows as "Cum Surplus". This row used to repeat
        `mvAfterFees` here, so the closing row of the table contradicted the
        summary pill above it: BIL.N0000 read 107,006,545.75 against the header's
        -89,852,215.05.
      */
      cumSurplus,
    },
    {
      label: 'Cost per share',
      date: null,
      unitPrice: costPerShare,
      shares: sharesAcquired,
      shareCumBal: null,
      purchaseCost: totalPurchase,
      // Everything the holding has realised plus what selling the rest would
      // fetch -- the proceeds side of the cost-per-share comparison.
      saleValue: totalSale + mvAfterFees,
      saleCost: totalSaleCost,
      avCost: last.av_cost,
      avPrice: avPriceOrNull(last),
      dividend: totalDividend,
      marketValue: last.market_value,
      mvAfterFees,
      cashFlow: totalCashFlow + mvAfterFees,
      // The list row's Total Surplus too (bug-50). This summed the rows a second
      // way, which agreed, and a second way is how bug-50 disagreed.
      totalSurplus: cumSurplus,
      // bug-47: repeated `mvAfterFees` after bug-46 fixed the row above, so
      // HNB.X0000 read 3,019,178,989.73 (its market value) here.
      cumSurplus,
    },
  ];
}

/**
 * Notes in the order they are replayed: by trade date, then by the order
 * someone stated for that date.
 *
 * A contract note carries a trade date and no trade time, so which of a same-day
 * buy and sell came first is not in the data. For a day of only buys, or only
 * sells, that does not matter -- both are commutative under average cost and the
 * day closes on the same position either way. For a day holding both it decides
 * the answer, which is why `intraday_seq` exists and why this is the only place
 * that reads it.
 *
 * `intraday_seq` is 1-based and scoped to the note's own (entity, share, date):
 * `computeRows` is called per group and a note carries one date, so a bare
 * integer is unambiguous.
 *
 * A null sequence means *unstated*, not zero and not first. Unstated notes run
 * after every sequenced note on their date, keeping the order they arrived in --
 * which the caller's `ORDER BY trade_date, id` makes deterministic. So a day
 * nobody has touched replays exactly as it did before this field existed.
 */
export function sortNotes<T extends { trade_date: string | null; intraday_seq?: number | null }>(
  notes: T[],
): T[] {
  // Unstated sorts after every stated position rather than before it, so adding
  // a sequence to one note of a day does not silently push the untouched ones in
  // front of it.
  const rank = (n: T) =>
    n.intraday_seq != null && n.intraday_seq > 0 ? n.intraday_seq : Number.MAX_SAFE_INTEGER;

  return [...notes].sort((a, b) => {
    const da = a.trade_date ?? '';
    const db = b.trade_date ?? '';
    if (da !== db) return da < db ? -1 : 1;
    return rank(a) - rank(b);
  });
}

/**
 * Does the order of this day's notes change where the day ends up?
 *
 * Only a day mixing a buy with a sell does. Buys commute: cost and quantity both
 * add. Sells commute too, and less obviously -- removing `qty * (C / S)` leaves
 * `C * (S - qty) / S` over `S - qty`, which is `C / S` again, so a sell never
 * moves the average and a run of them cannot. Mixed, the sell is costed at the
 * average either before or after the buy, and those are different numbers.
 *
 * Reported so the screen can point at the handful of days worth arguing about
 * instead of every day that happens to hold two notes.
 */
export function orderAffectsAverage(noteTypes: string[]): boolean {
  const isBuy = (t: string) => t === 'Buy' || t === 'BUY';
  return noteTypes.some(isBuy) && noteTypes.some(t => !isBuy(t));
}

export function computeRows(
  notes: RawNote[],
  opening: OpeningBalance | null,
  dividends: DividendRecord[],
  marketPrice: number,
  scrips: ScripRecord[] = [],
): ComputedRow[] {
  /*
    Ties must compare equal.

    These comparators used to return 1 for "not less than", so two events on the
    same date never compared equal and the sort was free to order them either
    way. That is not academic: a share with a buy and a sell of the same size on
    one day runs the two in whichever order the sort happened to produce, and
    each order leaves a different average cost behind.

    Returning 0 makes the sort stable by specification, so same-date events keep
    the order they arrived in -- the query sorts by (trade_date, id), so that
    order is itself deterministic. Same data in, same numbers out.
  */
  const byDate = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  const sorted     = sortNotes(notes);
  const sortedDivs = [...dividends].sort((a, b) => byDate(a.payment_date ?? '', b.payment_date ?? ''));
  const sortedScrips = [...scrips].sort((a, b) =>
    byDate(a.effective_date ?? a.entry_date, b.effective_date ?? b.entry_date));

  type Ev = { date: string } & (
    | { kind: 'note'; note: RawNote }
    | { kind: 'dividend'; div: DividendRecord }
    | { kind: 'scrip'; scrip: ScripRecord }
  );
  const events: Ev[] = [
    ...sorted.map(n => ({ date: n.trade_date ?? '', kind: 'note' as const, note: n })),
    ...sortedDivs.map(d => ({ date: d.payment_date ?? '', kind: 'dividend' as const, div: d })),
    ...sortedScrips.map(s => ({ date: s.effective_date ?? s.entry_date, kind: 'scrip' as const, scrip: s })),
  ].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  let heldShares  = opening ? opening.opening_shares : 0;
  let heldCost    = opening ? opening.opening_shares * opening.average_purchase_cost : 0;
  let cumPurchase = heldCost;
  let cumSale     = 0;
  let cumDividend = 0;

  const snap = () => {
    const av_price     = heldShares > 0 ? heldCost / heldShares : 0;
    const market_value = heldShares * marketPrice;
    const cum_surplus  = (cumSale + cumDividend) - cumPurchase;
    return {
      share_cum_bal: heldShares, av_cost: heldCost, av_price,
      cum_purchase_cost: cumPurchase, cum_sale_value: cumSale, cum_dividend: cumDividend,
      cum_surplus, market_value,
      total_surplus: (market_value + cumSale + cumDividend) - cumPurchase,
    };
  };

  const rows: ComputedRow[] = [];

  if (opening) {
    const s = snap();
    rows.push({
      id: `ob-${opening.entity_id}-${opening.share_id}`,
      note_type: 'Opening', trade_date: opening.effective_date,
      no_of_shares: opening.opening_shares, price_avg: opening.average_purchase_cost,
      gross_amount: heldCost, net_amount: heldCost,
      entity_id: opening.entity_id, entity_name: '', share_id: opening.share_id,
      share_ticker: '', share_name: '', cds_account: null,
      row_type: 'opening',
      purchase_cost: heldCost, sale_value: 0, dividend: 0,
      cash_flow: -heldCost, ...s,
    });
  }

  for (const ev of events) {
    if (ev.kind === 'note') {
      const n    = ev.note;
      const qty  = n.no_of_shares;
      const gross = n.gross_amount;
      const isBuy = n.note_type === 'Buy' || n.note_type === 'BUY';
      let purchase_cost = 0, sale_value = 0;

      if (isBuy) {
        purchase_cost = gross; heldShares += qty; heldCost += gross; cumPurchase += gross;
      } else {
        sale_value = gross;
        const avgCPS = heldShares > 0 ? heldCost / heldShares : 0;
        const remove = avgCPS * qty;
        heldShares = Math.max(0, heldShares - qty);
        heldCost   = Math.max(0, heldCost - remove);
        cumSale   += gross;
      }
      const s = snap();
      rows.push({ ...n, row_type: isBuy ? 'buy' : 'sell', purchase_cost, sale_value, dividend: 0, cash_flow: sale_value - purchase_cost, ...s });
    } else if (ev.kind === 'dividend') {
      const d = ev.div;
      cumDividend += d.amount_net;
      const s = snap();
      rows.push({
        id: `div-${d.entity_id}-${d.share_id}-${d.payment_date}`,
        note_type: 'Dividend', trade_date: d.payment_date,
        no_of_shares: 0, price_avg: null, gross_amount: d.amount_net, net_amount: d.amount_net,
        entity_id: d.entity_id, entity_name: '', share_id: d.share_id,
        share_ticker: '', share_name: '', cds_account: null,
        row_type: 'dividend',
        purchase_cost: 0, sale_value: 0, dividend: d.amount_net,
        cash_flow: d.amount_net, ...s,
      });
    } else {
      const sc = ev.scrip;
      const qty = sc.no_of_shares;
      heldShares += qty; // cost stays the same — scrip shares are free
      const s = snap();
      const date = sc.effective_date ?? sc.entry_date;
      rows.push({
        id: `scrip-${sc.entity_id}-${sc.share_id}-${date}`,
        note_type: 'Scrip', trade_date: date,
        no_of_shares: qty, price_avg: 0, gross_amount: 0, net_amount: 0,
        entity_id: sc.entity_id, entity_name: '', share_id: sc.share_id,
        share_ticker: '', share_name: '', cds_account: null,
        row_type: 'scrip',
        purchase_cost: 0, sale_value: 0, dividend: 0,
        cash_flow: 0, ...s,
      });
    }
  }
  return rows;
}
