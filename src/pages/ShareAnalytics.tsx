import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Entity {
  id: string;
  name: string;
}

interface RawNote {
  id: string;
  note_type: string;
  trade_date: string | null;
  no_of_shares: number;
  price_avg: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  brokerage: number | null;
  sec: number | null;
  exchange: number | null;
  cds: number | null;
  gov_cess: number | null;
  clearing_fees: number | null;
  foreign_brokerage: number | null;
  entity_id: string;
  entity_name: string;
  share_id: string;
  share_ticker: string;
  share_name: string;
}

interface ComputedRow extends RawNote {
  total_cost: number;
  sale_value: number;
  av_cost_buy: number;
  av_cost_sell: number;
  av_price: number;
}

interface ShareGroup {
  share_id: string;
  share_ticker: string;
  share_name: string;
  entity_id: string;
  entity_name: string;
  rows: ComputedRow[];
}

function computeRows(notes: RawNote[]): ComputedRow[] {
  // Sort chronologically
  const sorted = [...notes].sort((a, b) => {
    const da = a.trade_date ?? '';
    const db = b.trade_date ?? '';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  let heldShares = 0;
  let heldCost = 0; // total cost of current holdings at weighted avg cost

  return sorted.map(note => {
    const qty = Number(note.no_of_shares) || 0;
    const gross = Number(note.gross_amount) || 0;
    const isBuy = note.note_type === 'Buy' || note.note_type === 'BUY';

    let total_cost = 0;
    let sale_value = 0;
    let av_cost_sell = 0;

    if (isBuy) {
      total_cost = gross;
      heldShares += qty;
      heldCost += gross;
    } else {
      sale_value = gross;
      // avg cost per share before this sell
      const avgCostPerShare = heldShares > 0 ? heldCost / heldShares : 0;
      av_cost_sell = avgCostPerShare * qty;
      // reduce holdings
      const costToRemove = avgCostPerShare * qty;
      heldShares = Math.max(0, heldShares - qty);
      heldCost = Math.max(0, heldCost - costToRemove);
    }

    const av_cost_buy = heldCost;
    const av_price = heldShares > 0 ? heldCost / heldShares : 0;

    return {
      ...note,
      total_cost,
      sale_value,
      av_cost_buy,
      av_cost_sell,
      av_price,
    };
  });
}

export function ShareAnalytics() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
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
  }, [selectedEntityId, fromDate, toDate]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch supporting lookups in parallel
      const [entitiesRes, sharesRes, txnsRes] = await Promise.all([
        supabase.from('entities').select('id, name'),
        supabase.from('shares').select('id, ticker, name'),
        supabase.from('transactions').select('id, entity_id, share_id'),
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

      let notesQuery = supabase
        .from('buy_sell_notes')
        .select('id, note_type, trade_date, no_of_shares, price_avg, gross_amount, net_amount, brokerage, sec, exchange, cds, gov_cess, clearing_fees, foreign_brokerage, transaction_id')
        .order('trade_date', { ascending: true });

      if (fromDate) notesQuery = notesQuery.gte('trade_date', fromDate);
      if (toDate) notesQuery = notesQuery.lte('trade_date', toDate);

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
            gross_amount: n.gross_amount != null ? Number(n.gross_amount) : null,
            net_amount: n.net_amount != null ? Number(n.net_amount) : null,
            brokerage: n.brokerage != null ? Number(n.brokerage) : null,
            sec: n.sec != null ? Number(n.sec) : null,
            exchange: n.exchange != null ? Number(n.exchange) : null,
            cds: n.cds != null ? Number(n.cds) : null,
            gov_cess: n.gov_cess != null ? Number(n.gov_cess) : null,
            clearing_fees: n.clearing_fees != null ? Number(n.clearing_fees) : null,
            foreign_brokerage: n.foreign_brokerage != null ? Number(n.foreign_brokerage) : null,
            entity_id: txn.entity_id,
            entity_name: entityMap.get(txn.entity_id) ?? '—',
            share_id: txn.share_id,
            share_ticker: share.ticker,
            share_name: share.name,
          };
        })
        .filter((n: RawNote) => !selectedEntityId || n.entity_id === selectedEntityId);

      // Group by entity + share, then compute running totals within each group
      const map = new Map<string, RawNote[]>();
      for (const note of raw) {
        const key = `${note.entity_id}__${note.share_id}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(note);
      }

      const result: ShareGroup[] = [];
      for (const [, notes] of map) {
        const computed = computeRows(notes);
        const first = computed[0];
        result.push({
          share_id: first.share_id,
          share_ticker: first.share_ticker,
          share_name: first.share_name,
          entity_id: first.entity_id,
          entity_name: first.entity_name,
          rows: computed,
        });
      }

      // Sort groups by entity name then ticker
      result.sort((a, b) =>
        a.entity_name.localeCompare(b.entity_name) || a.share_ticker.localeCompare(b.share_ticker)
      );

      setGroups(result);
      // Auto-expand all groups
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

  const isBuy = (type: string) => type === 'Buy' || type === 'BUY';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Analytics</h1>
        <p className="text-gray-500 mt-1">Running cost analysis per share using weighted average cost method</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Entity</label>
            <select
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
            >
              <option value="">All Entities</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
          <p className="text-gray-300 text-sm mt-1">Adjust your filters to see results</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => {
            const key = `${group.entity_id}__${group.share_id}`;
            const isOpen = expandedGroups.has(key);
            const lastRow = group.rows[group.rows.length - 1];
            const totalBought = group.rows.filter(r => isBuy(r.note_type)).reduce((s, r) => s + r.total_cost, 0);
            const totalSold = group.rows.filter(r => !isBuy(r.note_type)).reduce((s, r) => s + r.sale_value, 0);

            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Total Bought</div>
                      <div className="font-semibold text-gray-800">Rs. {fmt(totalBought)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Total Sold</div>
                      <div className="font-semibold text-gray-800">Rs. {fmt(totalSold)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Av. Hold Cost</div>
                      <div className="font-semibold text-blue-700">Rs. {fmt(lastRow.av_cost_buy)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Av. Price</div>
                      <div className="font-semibold text-gray-800">Rs. {fmt(lastRow.av_price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Transactions</div>
                      <div className="font-semibold text-gray-800">{group.rows.length}</div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">No. of Shares</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Total Cost</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Sale Value</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Av Cost (Buy)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Av Cost (Sell)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Av Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, idx) => {
                          const buy = isBuy(row.note_type);
                          return (
                            <tr
                              key={row.id}
                              className={`border-b border-gray-50 ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                              } hover:bg-blue-50/30 transition-colors`}
                            >
                              <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                                {fmtDate(row.trade_date)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  buy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {buy
                                    ? <TrendingUp className="w-3 h-3" />
                                    : <TrendingDown className="w-3 h-3" />}
                                  {buy ? 'Buy' : 'Sell'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-700 font-mono">
                                {row.price_avg != null ? fmt(row.price_avg) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-700 font-mono">
                                {row.no_of_shares.toLocaleString()}
                              </td>
                              {/* Total Cost — buy: gross; sell: 0 */}
                              <td className="px-4 py-2.5 text-right font-mono">
                                <span className={row.total_cost > 0 ? 'text-gray-900' : 'text-gray-300'}>
                                  {row.total_cost > 0 ? fmt(row.total_cost) : '0'}
                                </span>
                              </td>
                              {/* Sale Value — sell: gross; buy: 0 */}
                              <td className="px-4 py-2.5 text-right font-mono">
                                <span className={row.sale_value > 0 ? 'text-gray-900' : 'text-gray-300'}>
                                  {row.sale_value > 0 ? fmt(row.sale_value) : '0'}
                                </span>
                              </td>
                              {/* Av Cost (Buy) = running total cost of holdings */}
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-blue-700">
                                {fmt(row.av_cost_buy)}
                              </td>
                              {/* Av Cost (Sell) = cost of sold shares at avg buy price */}
                              <td className="px-4 py-2.5 text-right font-mono">
                                <span className={row.av_cost_sell > 0 ? 'text-orange-700 font-semibold' : 'text-gray-300'}>
                                  {row.av_cost_sell > 0 ? fmt(row.av_cost_sell) : '—'}
                                </span>
                              </td>
                              {/* Av Price = weighted avg cost per share held */}
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">
                                {fmt(row.av_price)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Summary footer */}
                      <tfoot className="bg-gray-100 border-t-2 border-gray-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Totals</td>
                          <td className="px-4 py-2.5 text-right font-bold text-gray-900 font-mono">
                            {fmt(group.rows.reduce((s, r) => s + r.total_cost, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-gray-900 font-mono">
                            {fmt(group.rows.reduce((s, r) => s + r.sale_value, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-700 font-mono">
                            {fmt(lastRow.av_cost_buy)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-orange-700 font-mono">
                            {fmt(group.rows.reduce((s, r) => s + r.av_cost_sell, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-gray-900 font-mono">
                            {fmt(lastRow.av_price)}
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
