import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, BarChart2, X, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

interface Entity { id: string; name: string; }

interface OpeningBalance {
  entity_id: string;
  share_id: string;
  opening_shares: number;
  average_purchase_cost: number;
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
  purchase_cost: number;
  sale_value: number;
  dividend: number;
  share_cum_bal: number;
  av_cost: number;
  av_price: number;
  cum_purchase_cost: number;
  cum_sale_value: number;
  cum_dividend: number;
  market_value: number;
  cash_flow: number;
  total_surplus: number;
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

// ── Core calculation ─────────────────────────────────────────────────────────

function computeRows(
  notes: RawNote[],
  opening: OpeningBalance | null,
  dividends: DividendRecord[],
  marketPrice: number,
): ComputedRow[] {
  const sorted = [...notes].sort((a, b) => (a.trade_date ?? '') < (b.trade_date ?? '') ? -1 : 1);
  const sortedDivs = [...dividends].sort((a, b) => (a.payment_date ?? '') < (b.payment_date ?? '') ? -1 : 1);

  type Ev = { date: string } & (
    | { kind: 'note'; note: RawNote }
    | { kind: 'dividend'; div: DividendRecord }
  );
  const events: Ev[] = [
    ...sorted.map(n => ({ date: n.trade_date ?? '', kind: 'note' as const, note: n })),
    ...sortedDivs.map(d => ({ date: d.payment_date ?? '', kind: 'dividend' as const, div: d })),
  ].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  let heldShares  = opening ? opening.opening_shares : 0;
  let heldCost    = opening ? opening.opening_shares * opening.average_purchase_cost : 0;
  let cumPurchase = heldCost;
  let cumSale     = 0;
  let cumDividend = 0;

  const rows: ComputedRow[] = [];

  const snap = (): Pick<ComputedRow, 'share_cum_bal' | 'av_cost' | 'av_price' | 'cum_purchase_cost' | 'cum_sale_value' | 'cum_dividend' | 'market_value' | 'total_surplus'> => {
    const av_price    = heldShares > 0 ? heldCost / heldShares : 0;
    const market_value = heldShares * marketPrice;
    return {
      share_cum_bal: heldShares,
      av_cost: heldCost,
      av_price,
      cum_purchase_cost: cumPurchase,
      cum_sale_value: cumSale,
      cum_dividend: cumDividend,
      market_value,
      total_surplus: (market_value + cumSale + cumDividend) - cumPurchase,
    };
  };

  if (opening) {
    const s = snap();
    rows.push({
      id: `ob-${opening.entity_id}-${opening.share_id}`,
      note_type: 'Opening', trade_date: opening.effective_date,
      no_of_shares: opening.opening_shares, price_avg: opening.average_purchase_cost,
      gross_amount: heldCost,
      entity_id: opening.entity_id, entity_name: '', share_id: opening.share_id,
      share_ticker: '', share_name: '',
      row_type: 'opening',
      purchase_cost: heldCost, sale_value: 0, dividend: 0,
      cash_flow: -heldCost, ...s,
    });
  }

  for (const ev of events) {
    if (ev.kind === 'note') {
      const n = ev.note;
      const qty   = n.no_of_shares;
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
      rows.push({
        ...n, row_type: isBuy ? 'buy' : 'sell',
        purchase_cost, sale_value, dividend: 0,
        cash_flow: sale_value - purchase_cost, ...s,
      });
    } else {
      const d = ev.div;
      cumDividend += d.amount_net;
      const s = snap();
      rows.push({
        id: `div-${d.entity_id}-${d.share_id}-${d.payment_date}`,
        note_type: 'Dividend', trade_date: d.payment_date,
        no_of_shares: 0, price_avg: null, gross_amount: d.amount_net,
        entity_id: d.entity_id, entity_name: '', share_id: d.share_id,
        share_ticker: '', share_name: '',
        row_type: 'dividend',
        purchase_cost: 0, sale_value: 0, dividend: d.amount_net,
        cash_flow: d.amount_net, ...s,
      });
    }
  }
  return rows;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt  = (v: number, d = 2) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtN = (v: number, d = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB') : '—';

const surplusClass = (v: number) =>
  v > 0 ? 'text-green-700 font-semibold' : v < 0 ? 'text-red-600 font-semibold' : 'text-gray-400';

// ── Modal ────────────────────────────────────────────────────────────────────

function BreakdownModal({ group, onClose }: { group: ShareGroup; onClose: () => void }) {
  const last = group.rows[group.rows.length - 1];

  const badge = (type: string) => {
    if (type === 'Opening')
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Opening</span>;
    if (type === 'Dividend')
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Dividend</span>;
    const isBuy = type === 'Buy' || type === 'BUY';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isBuy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isBuy ? 'Buy' : 'Sell'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{group.share_ticker}</h2>
              <span className="text-sm text-gray-500">{group.share_name}</span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{group.entity_name}</p>
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-4 mr-6">
            <div className="text-center">
              <div className="text-xs text-gray-400">Shares Held</div>
              <div className="font-bold text-gray-900">{fmtN(last.share_cum_bal)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">Av Price</div>
              <div className="font-bold text-gray-900">Rs. {fmt(last.av_price)}</div>
            </div>
            {group.market_price > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-400">Market Price</div>
                <div className="font-bold text-gray-900">Rs. {fmt(group.market_price)}</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-xs text-gray-400">Market Value</div>
              <div className="font-bold text-blue-700">Rs. {fmt(last.market_value)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">Total Surplus</div>
              <div className={surplusClass(last.total_surplus)}>Rs. {fmt(last.total_surplus)}</div>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                {['Date','Status','Price','No. Shares','Share Cum Bal','Purchase Cost','Sale Value','Av Cost','Av Price','Dividend','Market Value','Cash Flow','Total Surplus'].map(h => (
                  <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${h === 'Date' || h === 'Status' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, idx) => {
                const isOp  = row.row_type === 'opening';
                const isDiv = row.row_type === 'dividend';
                const bg = isOp ? 'bg-blue-50/70' : isDiv ? 'bg-yellow-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                return (
                  <tr key={row.id} className={`${bg} border-b border-gray-50 hover:bg-blue-50/30 transition-colors`}>
                    <td className="px-3 py-2 text-gray-700">{fmtDate(row.trade_date)}</td>
                    <td className="px-3 py-2">{badge(row.note_type)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">{row.price_avg != null ? fmt(row.price_avg) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">{row.no_of_shares > 0 ? fmtN(row.no_of_shares) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{fmtN(row.share_cum_bal)}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.purchase_cost > 0 ? fmt(row.purchase_cost) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.sale_value > 0 ? fmt(row.sale_value) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">{fmt(row.av_cost)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{fmt(row.av_price)}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.dividend > 0 ? <span className="text-yellow-700 font-semibold">{fmt(row.dividend)}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-blue-600">{group.market_price > 0 ? fmt(row.market_value) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className={row.cash_flow > 0 ? 'text-green-700 font-semibold' : row.cash_flow < 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                        {row.cash_flow !== 0 ? fmt(row.cash_flow) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {group.market_price > 0 ? <span className={surplusClass(row.total_surplus)}>{fmt(row.total_surplus)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300">
              <tr className="text-xs font-bold">
                <td colSpan={5} className="px-3 py-2.5 text-gray-500 uppercase">Totals / Final</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(group.rows.reduce((s, r) => s + r.purchase_cost, 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(group.rows.reduce((s, r) => s + r.sale_value, 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-blue-700">{fmt(last.av_cost)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(last.av_price)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-yellow-700">{fmt(group.rows.reduce((s, r) => s + r.dividend, 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-blue-600">{group.market_price > 0 ? fmt(last.market_value) : '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono">
                  <span className={surplusClass(group.rows.reduce((s, r) => s + r.cash_flow, 0))}>
                    {fmt(group.rows.reduce((s, r) => s + r.cash_flow, 0))}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {group.market_price > 0 ? <span className={surplusClass(last.total_surplus)}>{fmt(last.total_surplus)}</span> : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ShareAnalytics() {
  const [entities, setEntities]           = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(false);
  const [groups, setGroups]               = useState<ShareGroup[]>([]);
  const [activeGroup, setActiveGroup]     = useState<ShareGroup | null>(null);

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) => setEntities(data || []));
  }, []);

  useEffect(() => { fetchData(); }, [selectedEntityId]);

  const fetchData = useCallback(async () => {
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

      const entityMap = new Map<string, string>((entitiesRes.data || []).map((e: any) => [e.id, e.name]));
      const shareMap  = new Map<string, { ticker: string; name: string }>((sharesRes.data || []).map((s: any) => [s.id, { ticker: s.ticker || '—', name: s.name || '—' }]));
      const txnMap    = new Map<string, { entity_id: string; share_id: string }>((txnsRes.data || []).map((t: any) => [t.id, { entity_id: t.entity_id, share_id: t.share_id }]));

      const openingMap = new Map<string, OpeningBalance>();
      for (const ob of (openingRes.data || [])) {
        openingMap.set(`${ob.entity_id}__${ob.share_id}`, {
          entity_id: ob.entity_id, share_id: ob.share_id,
          opening_shares: Number(ob.opening_shares),
          average_purchase_cost: Number(ob.average_purchase_cost),
          effective_date: ob.effective_date,
        });
      }

      const dividendMap = new Map<string, DividendRecord[]>();
      for (const d of (dividendsRes.data || [])) {
        const k = `${d.entity_id}__${d.share_id}`;
        if (!dividendMap.has(k)) dividendMap.set(k, []);
        dividendMap.get(k)!.push({ entity_id: d.entity_id, share_id: d.share_id, payment_date: d.payment_date, amount_net: Number(d.amount_net) || 0 });
      }

      const priceMap = new Map<string, number>();
      for (const p of (pricesRes.data || [])) {
        if (!priceMap.has(p.share_id)) priceMap.set(p.share_id, Number(p.share_price) || 0);
      }

      const { data: notesData, error: notesError } = await supabase
        .from('buy_sell_notes')
        .select('id, note_type, trade_date, no_of_shares, price_avg, gross_amount, transaction_id')
        .order('trade_date', { ascending: true });
      if (notesError) throw notesError;

      const raw: RawNote[] = (notesData || [])
        .filter((n: any) => txnMap.has(n.transaction_id))
        .map((n: any) => {
          const txn   = txnMap.get(n.transaction_id)!;
          const share = shareMap.get(txn.share_id) ?? { ticker: '—', name: '—' };
          return {
            id: n.id, note_type: n.note_type, trade_date: n.trade_date,
            no_of_shares: Number(n.no_of_shares) || 0,
            price_avg: n.price_avg != null ? Number(n.price_avg) : null,
            gross_amount: Number(n.gross_amount) || 0,
            entity_id: txn.entity_id, entity_name: entityMap.get(txn.entity_id) ?? '—',
            share_id: txn.share_id, share_ticker: share.ticker, share_name: share.name,
          };
        })
        .filter((n: RawNote) => !selectedEntityId || n.entity_id === selectedEntityId);

      const groupKeys = new Set<string>();
      for (const n of raw) groupKeys.add(`${n.entity_id}__${n.share_id}`);
      for (const [k] of openingMap) {
        if (!selectedEntityId || k.startsWith(selectedEntityId)) groupKeys.add(k);
      }

      const notesByGroup = new Map<string, RawNote[]>();
      for (const n of raw) {
        const k = `${n.entity_id}__${n.share_id}`;
        if (!notesByGroup.has(k)) notesByGroup.set(k, []);
        notesByGroup.get(k)!.push(n);
      }

      const result: ShareGroup[] = [];
      for (const key of groupKeys) {
        const notes   = notesByGroup.get(key) ?? [];
        const opening = openingMap.get(key) ?? null;
        const divs    = dividendMap.get(key) ?? [];
        if (notes.length === 0 && !opening) continue;

        const [entityId, shareId] = key.split('__');
        const share       = shareMap.get(shareId) ?? { ticker: '—', name: '—' };
        const entityName  = entityMap.get(entityId) ?? '—';
        const marketPrice = priceMap.get(shareId) ?? 0;

        const computed = computeRows(notes, opening, divs, marketPrice);
        for (const row of computed) {
          if (!row.entity_name) row.entity_name = entityName;
          if (!row.share_ticker) row.share_ticker = share.ticker;
          if (!row.share_name) row.share_name = share.name;
        }
        if (computed.length === 0) continue;

        result.push({ share_id: shareId, share_ticker: share.ticker, share_name: share.name, entity_id: entityId, entity_name: entityName, market_price: marketPrice, rows: computed });
      }

      result.sort((a, b) => a.entity_name.localeCompare(b.entity_name) || a.share_ticker.localeCompare(b.share_ticker));
      setGroups(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId]);

  const filtered = groups.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.share_ticker.toLowerCase().includes(q) || g.share_name.toLowerCase().includes(q) || g.entity_name.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Analytics</h1>
        <p className="text-gray-500 mt-1">Portfolio analysis using weighted average cost method. Click any row for a full transaction breakdown.</p>
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
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ticker, name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            {filtered.length} share{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <BarChart2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No data found</p>
          <p className="text-gray-300 text-sm mt-1">Adjust your filters to see results</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Share</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Entity</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Share Cum Bal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Sale Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Av Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Av Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Dividend</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Market Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Cash Flow</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Surplus</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Txns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((group, idx) => {
                  const last       = group.rows[group.rows.length - 1];
                  const totalPC    = group.rows.reduce((s, r) => s + r.purchase_cost, 0);
                  const totalSV    = group.rows.reduce((s, r) => s + r.sale_value, 0);
                  const totalDiv   = group.rows.reduce((s, r) => s + r.dividend, 0);
                  const totalCF    = group.rows.reduce((s, r) => s + r.cash_flow, 0);
                  const txnCount   = group.rows.filter(r => r.row_type === 'buy' || r.row_type === 'sell').length;

                  return (
                    <tr
                      key={`${group.entity_id}__${group.share_id}`}
                      onClick={() => setActiveGroup(group)}
                      className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/60`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{group.share_ticker}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{group.share_name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{group.entity_name}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmtN(last.share_cum_bal)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(totalPC)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{totalSV > 0 ? fmt(totalSV) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{fmt(last.av_cost)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(last.av_price)}</td>
                      <td className="px-4 py-3 text-right font-mono">{totalDiv > 0 ? <span className="text-yellow-700 font-semibold">{fmt(totalDiv)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 font-semibold">{group.market_price > 0 ? fmt(last.market_value) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={totalCF > 0 ? 'text-green-700 font-semibold' : totalCF < 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                          {fmt(totalCF)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {group.market_price > 0
                          ? <span className={surplusClass(last.total_surplus)}>{fmt(last.total_surplus)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">{txnCount}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Grand totals footer */}
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr className="text-xs font-bold">
                  <td colSpan={2} className="px-4 py-3 text-gray-500 uppercase">Grand Total ({filtered.length} shares)</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {fmtN(filtered.reduce((s, g) => s + g.rows[g.rows.length - 1].share_cum_bal, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {fmt(filtered.reduce((s, g) => s + g.rows.reduce((a, r) => a + r.purchase_cost, 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {fmt(filtered.reduce((s, g) => s + g.rows.reduce((a, r) => a + r.sale_value, 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">
                    {fmt(filtered.reduce((s, g) => s + g.rows[g.rows.length - 1].av_cost, 0))}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono text-yellow-700">
                    {fmt(filtered.reduce((s, g) => s + g.rows.reduce((a, r) => a + r.dividend, 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600">
                    {fmt(filtered.reduce((s, g) => s + g.rows[g.rows.length - 1].market_value, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={surplusClass(filtered.reduce((s, g) => s + g.rows.reduce((a, r) => a + r.cash_flow, 0), 0))}>
                      {fmt(filtered.reduce((s, g) => s + g.rows.reduce((a, r) => a + r.cash_flow, 0), 0))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={surplusClass(filtered.reduce((s, g) => s + g.rows[g.rows.length - 1].total_surplus, 0))}>
                      {fmt(filtered.reduce((s, g) => s + g.rows[g.rows.length - 1].total_surplus, 0))}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown modal */}
      {activeGroup && <BreakdownModal group={activeGroup} onClose={() => setActiveGroup(null)} />}
    </div>
  );
}
