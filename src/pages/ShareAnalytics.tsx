import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Entity {
  id: string;
  name: string;
}

interface OpeningBalance {
  entity_id: string;
  share_id: string;
  opening_shares: number;
  average_purchase_cost: number; // avg cost per share
  effective_date: string;
}

interface DividendRecord {
  entity_id: string;
  share_id: string;
  payment_date: string | null;
  amount_net: number;
}

interface RawNote {
  id: string;
  note_type: string;
  trade_date: string | null;
  no_of_shares: number;
  price_avg: number | null;
  gross_amount: number;
  entity_id: string;
  entity_name: string;
  share_id: string;
  share_ticker: string;
  share_name: string;
}

interface ComputedRow extends RawNote {
  row_type: 'opening' | 'buy' | 'sell' | 'dividend';
  // per-row values
  purchase_cost: number;  // buy: gross_amount; else 0
  sale_value: number;     // sell: gross_amount; else 0
  dividend: number;       // dividend row: amount_net; else 0
  // running cumulative values (after this row)
  share_cum_bal: number;  // cumulative shares held
  av_cost: number;        // total cost of holdings (WAC × shares)
  av_price: number;       // av_cost / share_cum_bal
  cum_purchase_cost: number;
  cum_sale_value: number;
  cum_dividend: number;
  // market-price dependent (filled in after)
  market_value: number;
  cash_flow: number;      // sale_value - purchase_cost (per row)
  total_surplus: number;  // (market_value + cum_sale_value + cum_dividend) - cum_purchase_cost
}

interface ShareGroup {
  share_id: string;
  share_ticker: string;
  share_name: string;
  entity_id: string;
  entity_name: string;
  market_price: number;
  rows: ComputedRow[];
}

// ────────────────────────────────────────────────────────────────────────────
// Core calculation — accepts an optional opening balance row injected first
// ────────────────────────────────────────────────────────────────────────────
function computeRows(
  notes: RawNote[],
  opening: OpeningBalance | null,
  dividends: DividendRecord[],
  marketPrice: number,
): ComputedRow[] {
  // Sort notes chronologically
  const sorted = [...notes].sort((a, b) => {
    const da = a.trade_date ?? '';
    const db = b.trade_date ?? '';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  // Sort dividends chronologically
  const sortedDivs = [...dividends].sort((a, b) => {
    const da = a.payment_date ?? '';
    const db = b.payment_date ?? '';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  // Build a merged timeline of notes + dividends
  type Event =
    | { kind: 'note'; note: RawNote }
    | { kind: 'dividend'; div: DividendRecord };

  const events: { date: string; event: Event }[] = [];

  for (const n of sorted) {
    events.push({ date: n.trade_date ?? '', event: { kind: 'note', note: n } });
  }
  for (const d of sortedDivs) {
    events.push({ date: d.payment_date ?? '', event: { kind: 'dividend', div: d } });
  }
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Running state — seed with opening balance if available
  let heldShares = opening ? opening.opening_shares : 0;
  let heldCost   = opening ? opening.opening_shares * opening.average_purchase_cost : 0;
  let cumPurchase = heldCost;
  let cumSale     = 0;
  let cumDividend = 0;

  const rows: ComputedRow[] = [];

  // Emit an "opening" row if there's an opening balance
  if (opening) {
    const avPrice = heldShares > 0 ? heldCost / heldShares : 0;
    const mv = heldShares * marketPrice;
    const surplus = (mv + cumSale + cumDividend) - cumPurchase;
    rows.push({
      id: `opening-${opening.entity_id}-${opening.share_id}`,
      note_type: 'Opening',
      trade_date: opening.effective_date,
      no_of_shares: opening.opening_shares,
      price_avg: opening.average_purchase_cost,
      gross_amount: heldCost,
      entity_id: opening.entity_id,
      entity_name: '',
      share_id: opening.share_id,
      share_ticker: '',
      share_name: '',
      row_type: 'opening',
      purchase_cost: heldCost,
      sale_value: 0,
      dividend: 0,
      share_cum_bal: heldShares,
      av_cost: heldCost,
      av_price: avPrice,
      cum_purchase_cost: cumPurchase,
      cum_sale_value: cumSale,
      cum_dividend: cumDividend,
      market_value: mv,
      cash_flow: -heldCost,
      total_surplus: surplus,
    });
  }

  for (const { event } of events) {
    if (event.kind === 'note') {
      const note = event.note;
      const qty = note.no_of_shares;
      const gross = note.gross_amount;
      const isBuy = note.note_type === 'Buy' || note.note_type === 'BUY';

      let purchase_cost = 0;
      let sale_value    = 0;
      let av_cost_sell  = 0;

      if (isBuy) {
        purchase_cost = gross;
        heldShares   += qty;
        heldCost     += gross;
        cumPurchase  += gross;
      } else {
        sale_value = gross;
        const avgCostPerShare = heldShares > 0 ? heldCost / heldShares : 0;
        av_cost_sell = avgCostPerShare * qty;
        heldShares   = Math.max(0, heldShares - qty);
        heldCost     = Math.max(0, heldCost - av_cost_sell);
        cumSale     += gross;
      }

      const av_price = heldShares > 0 ? heldCost / heldShares : 0;
      const mv       = heldShares * marketPrice;
      const surplus  = (mv + cumSale + cumDividend) - cumPurchase;

      rows.push({
        ...note,
        row_type: isBuy ? 'buy' : 'sell',
        purchase_cost,
        sale_value,
        dividend: 0,
        share_cum_bal: heldShares,
        av_cost: heldCost,
        av_price,
        cum_purchase_cost: cumPurchase,
        cum_sale_value: cumSale,
        cum_dividend: cumDividend,
        market_value: mv,
        cash_flow: sale_value - purchase_cost,
        total_surplus: surplus,
      });
    } else {
      // Dividend event
      const div = event.div;
      cumDividend += div.amount_net;

      const av_price = heldShares > 0 ? heldCost / heldShares : 0;
      const mv       = heldShares * marketPrice;
      const surplus  = (mv + cumSale + cumDividend) - cumPurchase;

      rows.push({
        id: `div-${div.entity_id}-${div.share_id}-${div.payment_date}`,
        note_type: 'Dividend',
        trade_date: div.payment_date,
        no_of_shares: 0,
        price_avg: null,
        gross_amount: div.amount_net,
        entity_id: div.entity_id,
        entity_name: '',
        share_id: div.share_id,
        share_ticker: '',
        share_name: '',
        row_type: 'dividend',
        purchase_cost: 0,
        sale_value: 0,
        dividend: div.amount_net,
        share_cum_bal: heldShares,
        av_cost: heldCost,
        av_price,
        cum_purchase_cost: cumPurchase,
        cum_sale_value: cumSale,
        cum_dividend: cumDividend,
        market_value: mv,
        cash_flow: div.amount_net,
        total_surplus: surplus,
      });
    }
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────────────────

export function ShareAnalytics() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ShareGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) => {
      setEntities(data || []);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedEntityId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [entitiesRes, sharesRes, txnsRes, openingRes, dividendsRes, pricesRes] = await Promise.all([
        supabase.from('entities').select('id, name'),
        supabase.from('shares').select('id, ticker, name'),
        supabase.from('transactions').select('id, entity_id, share_id'),
        supabase.from('entity_share_opening_balances').select('entity_id, share_id, opening_shares, average_purchase_cost, effective_date'),
        supabase.from('dividends').select('entity_id, share_id, payment_date, amount_net'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
      ]);

      const entityMap = new Map<string, string>(
        (entitiesRes.data || []).map((e: any) => [e.id, e.name])
      );
      const shareMap = new Map<string, { ticker: string; name: string }>(
        (sharesRes.data || []).map((s: any) => [s.id, { ticker: s.ticker || '—', name: s.name || '—' }])
      );
      const txnMap = new Map<string, { entity_id: string; share_id: string }>(
        (txnsRes.data || []).map((t: any) => [t.id, { entity_id: t.entity_id, share_id: t.share_id }])
      );

      // Opening balances keyed by entity+share
      const openingMap = new Map<string, OpeningBalance>();
      for (const ob of (openingRes.data || [])) {
        const key = `${ob.entity_id}__${ob.share_id}`;
        openingMap.set(key, {
          entity_id: ob.entity_id,
          share_id: ob.share_id,
          opening_shares: Number(ob.opening_shares),
          average_purchase_cost: Number(ob.average_purchase_cost),
          effective_date: ob.effective_date,
        });
      }

      // Dividends grouped by entity+share
      const dividendMap = new Map<string, DividendRecord[]>();
      for (const d of (dividendsRes.data || [])) {
        const key = `${d.entity_id}__${d.share_id}`;
        if (!dividendMap.has(key)) dividendMap.set(key, []);
        dividendMap.get(key)!.push({
          entity_id: d.entity_id,
          share_id: d.share_id,
          payment_date: d.payment_date,
          amount_net: Number(d.amount_net) || 0,
        });
      }

      // Latest market price per share (first row after ordering desc)
      const priceMap = new Map<string, number>();
      for (const p of (pricesRes.data || [])) {
        if (!priceMap.has(p.share_id)) {
          priceMap.set(p.share_id, Number(p.share_price) || 0);
        }
      }

      // Fetch notes
      let notesQuery = supabase
        .from('buy_sell_notes')
        .select('id, note_type, trade_date, no_of_shares, price_avg, gross_amount, transaction_id')
        .order('trade_date', { ascending: true });

      const { data: notesData, error: notesError } = await notesQuery;
      if (notesError) throw notesError;

      const raw: RawNote[] = (notesData || [])
        .filter((n: any) => txnMap.has(n.transaction_id))
        .map((n: any) => {
          const txn = txnMap.get(n.transaction_id)!;
          const share = shareMap.get(txn.share_id) ?? { ticker: '—', name: '—' };
          return {
            id: n.id,
            note_type: n.note_type,
            trade_date: n.trade_date,
            no_of_shares: Number(n.no_of_shares) || 0,
            price_avg: n.price_avg != null ? Number(n.price_avg) : null,
            gross_amount: Number(n.gross_amount) || 0,
            entity_id: txn.entity_id,
            entity_name: entityMap.get(txn.entity_id) ?? '—',
            share_id: txn.share_id,
            share_ticker: share.ticker,
            share_name: share.name,
          };
        })
        .filter((n: RawNote) => !selectedEntityId || n.entity_id === selectedEntityId);

      // Collect all entity+share combos from both notes AND opening balances
      const groupKeys = new Set<string>();
      for (const n of raw) groupKeys.add(`${n.entity_id}__${n.share_id}`);
      if (selectedEntityId) {
        for (const [k] of openingMap) {
          if (k.startsWith(selectedEntityId)) groupKeys.add(k);
        }
      } else {
        for (const [k] of openingMap) groupKeys.add(k);
      }

      // Group notes by entity+share
      const notesByGroup = new Map<string, RawNote[]>();
      for (const n of raw) {
        const key = `${n.entity_id}__${n.share_id}`;
        if (!notesByGroup.has(key)) notesByGroup.set(key, []);
        notesByGroup.get(key)!.push(n);
      }

      const result: ShareGroup[] = [];
      for (const key of groupKeys) {
        const notes = notesByGroup.get(key) ?? [];
        const opening = openingMap.get(key) ?? null;
        const divs = dividendMap.get(key) ?? [];

        // Need at least notes or opening balance to show
        if (notes.length === 0 && !opening) continue;

        const [entityId, shareId] = key.split('__');
        const share = shareMap.get(shareId) ?? { ticker: '—', name: '—' };
        const entityName = entityMap.get(entityId) ?? '—';
        const marketPrice = priceMap.get(shareId) ?? 0;

        // Use first note to populate entity/share info on computed rows
        const sampleNote: RawNote = notes[0] ?? {
          id: '', note_type: '', trade_date: null,
          no_of_shares: 0, price_avg: null, gross_amount: 0,
          entity_id: entityId, entity_name: entityName,
          share_id: shareId, share_ticker: share.ticker, share_name: share.name,
        };

        // Fix entity/share info on all raw notes (they already have it from map)
        const computed = computeRows(notes, opening, divs, marketPrice);

        // Backfill entity/share info on opening and dividend rows
        for (const row of computed) {
          if (!row.entity_name) row.entity_name = entityName;
          if (!row.share_ticker) row.share_ticker = share.ticker;
          if (!row.share_name) row.share_name = share.name;
        }

        if (computed.length === 0) continue;

        result.push({
          share_id: shareId,
          share_ticker: share.ticker,
          share_name: share.name,
          entity_id: entityId,
          entity_name: entityName,
          market_price: marketPrice,
          rows: computed,
        });

        // suppress unused warning
        void sampleNote;
      }

      result.sort((a, b) =>
        a.entity_name.localeCompare(b.entity_name) || a.share_ticker.localeCompare(b.share_ticker)
      );

      setGroups(result);
      setExpandedGroups(new Set(result.map(g => `${g.entity_id}__${g.share_id}`)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const fmt = (v: number, dec = 2) =>
    v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const fmtDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString() : '—';

  const rowBadge = (type: string) => {
    switch (type) {
      case 'Opening':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Opening</span>;
      case 'Dividend':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Dividend</span>;
      case 'Buy': case 'BUY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <TrendingUp className="w-3 h-3" />Buy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <TrendingDown className="w-3 h-3" />Sell
          </span>
        );
    }
  };

  const surplusColor = (v: number) =>
    v > 0 ? 'text-green-700 font-bold' : v < 0 ? 'text-red-600 font-bold' : 'text-gray-400';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Analytics</h1>
        <p className="text-gray-500 mt-1">Running weighted average cost analysis per share</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Entity</label>
            <select
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
            >
              <option value="">All Entities</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <BarChart2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No data found</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => {
            const key = `${group.entity_id}__${group.share_id}`;
            const isOpen = expandedGroups.has(key);
            const last = group.rows[group.rows.length - 1];

            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div>
                      <div className="font-bold text-gray-900 text-base">{group.share_ticker}</div>
                      <div className="text-xs text-gray-500">{group.share_name} · {group.entity_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm">
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Shares Held</div>
                      <div className="font-semibold text-gray-800">{last.share_cum_bal.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Av Price</div>
                      <div className="font-semibold text-gray-800">Rs. {fmt(last.av_price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Market Price</div>
                      <div className="font-semibold text-gray-800">
                        {group.market_price > 0 ? `Rs. ${fmt(group.market_price)}` : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Market Value</div>
                      <div className="font-semibold text-blue-700">Rs. {fmt(last.market_value)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Total Surplus</div>
                      <div className={surplusColor(last.total_surplus)}>
                        Rs. {fmt(last.total_surplus)}
                      </div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Shares</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Share Cum Bal</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Cost</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Sale Value</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Av Cost</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Av Price</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Dividend</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Market Value</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Cash Flow</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Surplus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, idx) => {
                          const isOpening  = row.row_type === 'opening';
                          const isDividend = row.row_type === 'dividend';
                          const isBuy      = row.row_type === 'buy';
                          const rowBg = isOpening
                            ? 'bg-blue-50/60'
                            : isDividend
                            ? 'bg-yellow-50/50'
                            : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';

                          return (
                            <tr key={row.id} className={`${rowBg} border-b border-gray-50 hover:bg-blue-50/20 transition-colors`}>
                              <td className="px-3 py-2 text-gray-700">{fmtDate(row.trade_date)}</td>
                              <td className="px-3 py-2">{rowBadge(row.note_type)}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-700">
                                {row.price_avg != null ? fmt(row.price_avg) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-gray-700">
                                {row.no_of_shares > 0 ? row.no_of_shares.toLocaleString() : '—'}
                              </td>
                              {/* Share Cum Bal */}
                              <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                                {row.share_cum_bal.toLocaleString()}
                              </td>
                              {/* Purchase Cost */}
                              <td className="px-3 py-2 text-right font-mono">
                                {row.purchase_cost > 0
                                  ? <span className="text-gray-900">{fmt(row.purchase_cost)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              {/* Sale Value */}
                              <td className="px-3 py-2 text-right font-mono">
                                {row.sale_value > 0
                                  ? <span className="text-gray-900">{fmt(row.sale_value)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              {/* Av Cost = total cost of holdings */}
                              <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">
                                {fmt(row.av_cost)}
                              </td>
                              {/* Av Price = av cost / shares held */}
                              <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                                {fmt(row.av_price)}
                              </td>
                              {/* Dividend */}
                              <td className="px-3 py-2 text-right font-mono">
                                {row.dividend > 0
                                  ? <span className="text-yellow-700 font-semibold">{fmt(row.dividend)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              {/* Market Value */}
                              <td className="px-3 py-2 text-right font-mono font-semibold text-blue-600">
                                {group.market_price > 0 ? fmt(row.market_value) : <span className="text-gray-300">—</span>}
                              </td>
                              {/* Cash Flow */}
                              <td className="px-3 py-2 text-right font-mono">
                                <span className={
                                  row.cash_flow > 0 ? 'text-green-700 font-semibold'
                                  : row.cash_flow < 0 ? 'text-red-600 font-semibold'
                                  : 'text-gray-300'
                                }>
                                  {row.cash_flow !== 0 ? fmt(row.cash_flow) : '—'}
                                </span>
                              </td>
                              {/* Total Surplus */}
                              <td className="px-3 py-2 text-right font-mono">
                                {group.market_price > 0
                                  ? <span className={surplusColor(row.total_surplus)}>{fmt(row.total_surplus)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              {/* suppress unused var */}
                              {void isBuy}
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* Summary footer */}
                      <tfoot className="bg-gray-100 border-t-2 border-gray-200 text-xs">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 font-bold text-gray-500 uppercase">Totals / Final</td>
                          {/* Purchase Cost total */}
                          <td className="px-3 py-2 text-right font-bold text-gray-900 font-mono">
                            {fmt(group.rows.reduce((s, r) => s + r.purchase_cost, 0))}
                          </td>
                          {/* Sale Value total */}
                          <td className="px-3 py-2 text-right font-bold text-gray-900 font-mono">
                            {fmt(group.rows.reduce((s, r) => s + r.sale_value, 0))}
                          </td>
                          {/* Av Cost — last row */}
                          <td className="px-3 py-2 text-right font-bold text-blue-700 font-mono">
                            {fmt(last.av_cost)}
                          </td>
                          {/* Av Price — last row */}
                          <td className="px-3 py-2 text-right font-bold text-gray-900 font-mono">
                            {fmt(last.av_price)}
                          </td>
                          {/* Dividend total */}
                          <td className="px-3 py-2 text-right font-bold text-yellow-700 font-mono">
                            {fmt(group.rows.reduce((s, r) => s + r.dividend, 0))}
                          </td>
                          {/* Market Value — last row */}
                          <td className="px-3 py-2 text-right font-bold text-blue-600 font-mono">
                            {group.market_price > 0 ? fmt(last.market_value) : '—'}
                          </td>
                          {/* Cash Flow total */}
                          <td className="px-3 py-2 text-right font-bold font-mono">
                            <span className={surplusColor(group.rows.reduce((s, r) => s + r.cash_flow, 0))}>
                              {fmt(group.rows.reduce((s, r) => s + r.cash_flow, 0))}
                            </span>
                          </td>
                          {/* Total Surplus — last row */}
                          <td className="px-3 py-2 text-right font-mono">
                            {group.market_price > 0
                              ? <span className={surplusColor(last.total_surplus)}>{fmt(last.total_surplus)}</span>
                              : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
