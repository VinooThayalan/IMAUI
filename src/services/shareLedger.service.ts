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
