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

    Which of a same-day buy and sell truly came first is not recorded anywhere:
    the notes carry a trade date but no trade time. Deterministic is the most
    this can be without that.
  */
  const byDate = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  const sorted     = [...notes].sort((a, b) => byDate(a.trade_date ?? '', b.trade_date ?? ''));
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
