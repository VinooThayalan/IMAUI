import { ArrowUpDown, Download, FileText, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';
import { formatAer, portfolioAer, type CashFlow, type PortfolioAerResult } from '../lib/aer';

function fmtCompact(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rs. ${(abs / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000)     return `${sign}Rs. ${(abs / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000)         return `${sign}Rs. ${(abs / 1_000).toFixed(2)}k`;
  return `Rs. ${v.toFixed(2)}`;
}

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface PortfolioRow {
  entity_id: string;
  entity_name: string;
  cds_accounts: string[];
  sector: string;
  share_id: string;
  ticker: string;
  share_name: string;
  balance_shares: number;
  cost: number;
  cost_per_share: number;
  market_price_per_share: number;
  market_value_net: number;
  div: number;
  total_returns: number;
  /** null when the XIRR has no solution — must not be flattened to 0%. */
  aer: number | null;
  cash_dps_last_fy: number;
  cash_div: number;
  remarks: string;
}

/** Everything the portfolio-level AER needs from one cached holding. */
interface AerInput {
  entity_id: string;
  ticker: string;
  cashFlows: CashFlow[];
  heldShares: number;
  marketPrice: number;
  brokerageFeeRate: number;
}

type SortField = Exclude<keyof PortfolioRow, 'cds_accounts'>;
type SortDirection = 'asc' | 'desc';

export function PortfolioSummary() {
  const [data, setData] = useState<PortfolioRow[]>([]);
  const [aerInputs, setAerInputs] = useState<AerInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('entity_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  // Editable overrides: key = entity_id_share_id
  const [editedDps, setEditedDps]       = useState<Map<string, string>>(new Map());
  const [editedRemarks, setEditedRemarks] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchPortfolioData();
  }, [asOfDate]);

  async function fetchPortfolioData() {
    try {
      setLoading(true);

      const [bsnMax, txnMax, obMax, divMax, priceMax, scripMax, shareMax, entMax] = await Promise.all([
        supabase.from('buy_sell_notes').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('transactions').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('entity_share_opening_balances').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('dividends').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('daily_share_prices').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('scrip_entries').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('shares').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('entities').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      ]);
      const fingerprint = [
        bsnMax.data?.[0]?.updated_at   ?? '0',
        txnMax.data?.[0]?.updated_at   ?? '0',
        obMax.data?.[0]?.updated_at    ?? '0',
        divMax.data?.[0]?.updated_at   ?? '0',
        priceMax.data?.[0]?.updated_at ?? '0',
        scripMax.data?.[0]?.updated_at ?? '0',
        shareMax.data?.[0]?.updated_at ?? '0',
        entMax.data?.[0]?.updated_at   ?? '0',
      ].join('|');
      const sourceHash = btoa(fingerprint).replace(/[/+=]/g, '');

      // Paged, and ordered by row_index rather than trade_date.
      //
      // Unbounded, this select was capped at db-max-rows and quietly dropped
      // whole entities off the end of the table. Ordering by trade_date was the
      // second half of the problem: Postgres sorts NULLs last, so a share with
      // one undated note had its *earliest* event read as the closing position,
      // while Share Analytics — sorting in JS, where NULL became '' — read the
      // latest. row_index is the order the rows were actually computed in, so
      // both screens now land on the same row.
      const cacheRows = await selectAll(() =>
        supabase
          .from('share_analytics_cache')
          .select('entity_id, share_id, entity_name, share_ticker, share_name, share_cum_bal, av_cost, market_value, cum_dividend, cum_purchase_cost, cum_sale_value, market_price, brokerage_fee_rate, cds_accounts, aer, trade_date, cash_flow, source_hash')
          .eq('source_hash', sourceHash)
          .order('entity_name', { ascending: true })
          .order('share_ticker', { ascending: true })
          .order('row_index', { ascending: true })
          .order('id', { ascending: true }),
      );

      if (!cacheRows || cacheRows.length === 0) {
        setData([]);
        setAerInputs([]);
        return;
      }

      const lastRowMap = new Map<string, {
        entity_id: string; share_id: string; entity_name: string;
        share_ticker: string; share_name: string;
        share_cum_bal: number; av_cost: number; market_value: number;
        cum_dividend: number; cum_purchase_cost: number; cum_sale_value: number;
        market_price: number; brokerage_fee_rate: number; cds_accounts: string[];
        aer: number | null;
      }>();
      // Cash flows per holding, kept so this report can compute its own
      // portfolio-level AER instead of only showing per-share figures.
      const cashFlowMap = new Map<string, CashFlow[]>();

      for (const r of cacheRows) {
        const key = `${r.entity_id}_${r.share_id}`;

        const flow = Number(r.cash_flow) || 0;
        if (flow !== 0 && r.trade_date) {
          if (!cashFlowMap.has(key)) cashFlowMap.set(key, []);
          cashFlowMap.get(key)!.push({ date: new Date(r.trade_date + 'T00:00:00'), amount: flow });
        }

        lastRowMap.set(key, {
          entity_id: r.entity_id, share_id: r.share_id,
          entity_name: r.entity_name, share_ticker: r.share_ticker, share_name: r.share_name,
          share_cum_bal: Number(r.share_cum_bal) || 0,
          av_cost: Number(r.av_cost) || 0,
          market_value: Number(r.market_value) || 0,
          cum_dividend: Number(r.cum_dividend) || 0,
          cum_purchase_cost: Number(r.cum_purchase_cost) || 0,
          cum_sale_value: Number(r.cum_sale_value) || 0,
          market_price: Number(r.market_price) || 0,
          brokerage_fee_rate: Number(r.brokerage_fee_rate) || 0,
          cds_accounts: r.cds_accounts ?? [],
          aer: r.aer != null ? Number(r.aer) : null,
        });
      }

      const [sharesRes2, divRes2] = await Promise.all([
        supabase.from('shares').select('id, sector, sector_types(sector_name)'),
        supabase.from('dividends').select('share_id, entity_id, net_dividend_per_share').order('payment_date', { ascending: false }),
      ]);
      const shareSectorMap = new Map<string, string>();
      (sharesRes2.data || []).forEach((s: {
        id: string;
        sector?: string;
        sector_types?: { sector_name: string } | { sector_name: string }[] | null;
      }) => {
        const st = Array.isArray(s.sector_types) ? s.sector_types[0] : s.sector_types;
        shareSectorMap.set(s.id, st?.sector_name || s.sector || 'N/A');
      });
      const dpsMap = new Map<string, number>();
      (divRes2.data || []).forEach((d: { share_id: string; entity_id: string; net_dividend_per_share?: number }) => {
        const key = `${d.entity_id}_${d.share_id}`;
        if (!dpsMap.has(key) && d.net_dividend_per_share != null) {
          dpsMap.set(key, Number(d.net_dividend_per_share));
        }
      });

      const portfolioData: PortfolioRow[] = [];
      // Built from every holding, including fully-exited ones: a portfolio
      // return has to carry the positions that were bought and sold, not just
      // what happens to be held today.
      const aerRows: AerInput[] = [];

      lastRowMap.forEach((h, key) => {
        aerRows.push({
          entity_id: h.entity_id,
          ticker: h.share_ticker || 'N/A',
          cashFlows: cashFlowMap.get(key) ?? [],
          heldShares: h.share_cum_bal,
          marketPrice: h.market_price,
          brokerageFeeRate: h.brokerage_fee_rate,
        });

        if (h.share_cum_bal <= 0) return;
        const feeRate = h.brokerage_fee_rate / 100;
        const marketValueNet = h.market_value * (1 - feeRate);
        const totalReturns = marketValueNet + h.cum_sale_value + h.cum_dividend - h.cum_purchase_cost;
        const dps = dpsMap.get(key) ?? 0;
        portfolioData.push({
          entity_id: h.entity_id,
          entity_name: h.entity_name,
          cds_accounts: h.cds_accounts,
          sector: shareSectorMap.get(h.share_id) || 'N/A',
          share_id: h.share_id,
          ticker: h.share_ticker || 'N/A',
          share_name: h.share_name || 'N/A',
          balance_shares: h.share_cum_bal,
          cost: h.av_cost,
          cost_per_share: h.share_cum_bal > 0 ? h.av_cost / h.share_cum_bal : 0,
          market_price_per_share: h.market_price,
          market_value_net: marketValueNet,
          div: h.cum_dividend,
          total_returns: totalReturns,
          // Left null when there is no solution. Coercing it to 0 rendered an
          // uncomputable return as a green 0.00%, indistinguishable from a real
          // flat return — which is how broken inputs stayed invisible here.
          aer: h.aer,
          cash_dps_last_fy: dps,
          cash_div: h.share_cum_bal * dps,
          remarks: '',
        });
      });

      portfolioData.sort((a, b) => a.entity_name.localeCompare(b.entity_name) || a.ticker.localeCompare(b.ticker));
      setData(portfolioData);
      setAerInputs(aerRows);
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      alert('Failed to fetch portfolio data');
    } finally {
      setLoading(false);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const entityOptions = Array.from(new Map(data.map(r => [r.entity_id, r.entity_name])).entries());

  function getSortedData(): PortfolioRow[] {
    const filtered = selectedEntityId ? data.filter(r => r.entity_id === selectedEntityId) : data;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // Rows with no computable AER sort to the bottom either way, rather than
      // being string-compared as "null".
      if (aVal === null || bVal === null) {
        if (aVal === null && bVal === null) return 0;
        return aVal === null ? 1 : -1;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }

  function SortableHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    return (
      <th
        onClick={() => handleSort(field)}
        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors border-r border-gray-200"
      >
        <div className="flex items-center space-x-1">
          <span>{children}</span>
          <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
        </div>
      </th>
    );
  }

  const filteredData = selectedEntityId ? data.filter(r => r.entity_id === selectedEntityId) : data;
  const totalCost = filteredData.reduce((sum, row) => sum + row.cost, 0);
  const totalReturns = filteredData.reduce((sum, row) => sum + row.total_returns, 0);
  const totalDiv = filteredData.reduce((sum, row) => sum + row.div, 0);
  const totalCashDiv = filteredData.reduce((sum, row) => sum + row.cash_div, 0);

  // Portfolio-level AER, computed through the same helper Share Analytics uses
  // so the two screens can be compared like for like. The column above is a
  // per-share XIRR; this pools every holding's cash flows into one rate, and
  // the two are not expected to be equal.
  const portfolioAerResult: PortfolioAerResult = portfolioAer(
    (selectedEntityId ? aerInputs.filter(a => a.entity_id === selectedEntityId) : aerInputs)
      .map(a => ({
        label: a.ticker,
        cashFlows: a.cashFlows,
        heldShares: a.heldShares,
        marketPrice: a.marketPrice,
        brokerageFeeRate: a.brokerageFeeRate,
      })),
    new Date(),
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading portfolio summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Summary Report</h1>
          <p className="text-gray-500 mt-1">Comprehensive portfolio holdings with cost and return analysis</p>
        </div>
        <button
          onClick={() => exportCsv(
            `portfolio_summary_${asOfDate}.csv`,
            ['Entity','Sector','Share','Balance Shares','Cost','Cost per Share','Market Price per Share','Market Value (Net)','Div','Total Returns','AER %','Cash DPS (net) last FY','CDS Account','Remarks','Cash Div'],
            getSortedData().map(r => {
              const key = `${r.entity_id}_${r.share_id}`;
              const dpsOverride = editedDps.get(key);
              const dps = dpsOverride !== undefined ? (parseFloat(dpsOverride) || 0) : r.cash_dps_last_fy;
              const cashDiv = r.balance_shares * dps;
              return [
                r.entity_name, r.sector, r.ticker, r.balance_shares,
                r.cost.toFixed(2), r.cost_per_share.toFixed(2), r.market_price_per_share.toFixed(2),
                r.market_value_net.toFixed(2), r.div.toFixed(2), r.total_returns.toFixed(2),
                formatAer(r.aer), dps.toFixed(2),
                r.cds_accounts.join('; '), editedRemarks.get(key) ?? r.remarks ?? '', cashDiv.toFixed(2),
              ];
            })
          )}
          disabled={data.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">As of Date:</label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Entity:</label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Entities</option>
                {entityOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Total Cost</p>
              <p className="text-lg font-bold text-gray-900">{fmtCompact(totalCost)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Total Returns</p>
              <p className={`text-lg font-bold ${totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtCompact(totalReturns)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Portfolio AER</p>
              <p className={`text-lg font-bold ${
                portfolioAerResult.percent === null ? 'text-gray-400'
                  : portfolioAerResult.percent >= 0 ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {formatAer(portfolioAerResult.percent)}
              </p>
            </div>
          </div>
        </div>

        {/* Held positions with no market price have no terminal value and cannot
            enter the pooled XIRR. Naming them here is what makes a missing price
            upload visible instead of silently distorting the return. */}
        {portfolioAerResult.excluded.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <span className="font-semibold">
              {portfolioAerResult.excluded.length} held share
              {portfolioAerResult.excluded.length === 1 ? ' has' : 's have'} no market price and
              {portfolioAerResult.excluded.length === 1 ? ' is' : ' are'} excluded from the portfolio AER:
            </span>{' '}
            {portfolioAerResult.excluded.join(', ')}. Upload their latest prices for a complete figure.
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="entity_name">Entity</SortableHeader>
                <SortableHeader field="sector">Sector</SortableHeader>
                <SortableHeader field="ticker">Share</SortableHeader>
                <SortableHeader field="balance_shares">Balance No. of shares</SortableHeader>
                <SortableHeader field="cost">Cost</SortableHeader>
                <SortableHeader field="cost_per_share">Cost per share</SortableHeader>
                <SortableHeader field="market_price_per_share">Market price per share</SortableHeader>
                <SortableHeader field="market_value_net">Market Value (Net)</SortableHeader>
                <SortableHeader field="div">Div</SortableHeader>
                <SortableHeader field="total_returns">Total Returns</SortableHeader>
                <SortableHeader field="aer">AER %</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase border-r border-gray-200 bg-blue-50" title="Click cell to edit">Cash DPS (Net) Last FY ✎</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200">CDS Account</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase border-r border-gray-200 bg-blue-50" title="Click cell to edit">Remarks ✎</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase border-r border-gray-200 bg-blue-50" title="Calculated from Cash DPS × Balance">Cash Div</th>
              </tr>
            </thead>
            <tbody>
              {getSortedData().map((row, idx) => (
                <tr key={`${row.entity_id}_${row.share_id}`} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">{row.entity_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{row.sector}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 border-r border-gray-200">{row.ticker}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 border-r border-gray-200">
                    {row.balance_shares.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                    Rs. {row.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                    Rs. {row.cost_per_share.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                    Rs. {row.market_price_per_share.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-blue-700 border-r border-gray-200">
                    Rs. {row.market_value_net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                    Rs. {row.div.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-bold border-r border-gray-200 ${row.total_returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Rs. {row.total_returns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-right font-semibold border-r border-gray-200 ${
                      row.aer === null ? 'text-gray-400' : row.aer >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                    title={row.aer === null ? 'No annualised return can be computed — the holding has no market price, or all its cash flows fall on one day' : undefined}
                  >
                    {formatAer(row.aer)}
                  </td>
                  {/* Editable: Cash DPS (Net) Last FY */}
                  <td className="px-2 py-1 text-sm text-right border-r border-gray-200 bg-blue-50/40">
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 px-2 py-1 text-right text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      value={editedDps.get(`${row.entity_id}_${row.share_id}`) ?? row.cash_dps_last_fy.toFixed(2)}
                      onChange={e => setEditedDps(prev => new Map(prev).set(`${row.entity_id}_${row.share_id}`, e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 font-mono">
                    {row.cds_accounts.length > 0
                      ? row.cds_accounts.map((cds, i) => <div key={i}>{cds}</div>)
                      : <span className="text-gray-300">—</span>}
                  </td>
                  {/* Editable: Remarks */}
                  <td className="px-2 py-1 text-sm border-r border-gray-200 bg-blue-50/40">
                    <input
                      type="text"
                      className="w-36 px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      placeholder="Add remark…"
                      value={editedRemarks.get(`${row.entity_id}_${row.share_id}`) ?? row.remarks ?? ''}
                      onChange={e => setEditedRemarks(prev => new Map(prev).set(`${row.entity_id}_${row.share_id}`, e.target.value))}
                    />
                  </td>
                  {/* Cash Div: computed from overridden DPS × balance shares */}
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200 bg-blue-50/40">
                    {(() => {
                      const key = `${row.entity_id}_${row.share_id}`;
                      const dpsStr = editedDps.get(key);
                      const dps = dpsStr !== undefined ? (parseFloat(dpsStr) || 0) : row.cash_dps_last_fy;
                      return `Rs. ${(row.balance_shares * dps).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr className="font-bold">
                {/* cols 1-4: Entity, Sector, Share, Balance Shares */}
                <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">TOTAL</td>
                {/* col 5: Cost */}
                <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                  Rs. {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {/* cols 6-7: Cost per share, Market price per share */}
                <td colSpan={2} className="px-4 py-3 border-r border-gray-200"></td>
                {/* col 8: Market Value Net */}
                <td className="px-4 py-3 text-sm text-right font-semibold text-blue-700 border-r border-gray-200">
                  Rs. {filteredData.reduce((s, r) => s + r.market_value_net, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {/* col 9: Div */}
                <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                  Rs. {totalDiv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {/* col 10: Total Returns */}
                <td className={`px-4 py-3 text-sm text-right border-r border-gray-200 ${totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Rs. {totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {/* col 11: portfolio AER — one pooled XIRR, not a total of the column above */}
                <td
                  className={`px-4 py-3 text-sm text-right border-r border-gray-200 ${
                    portfolioAerResult.percent === null ? 'text-gray-400'
                      : portfolioAerResult.percent >= 0 ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                  title="Portfolio AER — XIRR over every holding's pooled cash flows. Not the sum or average of the per-share column."
                >
                  {formatAer(portfolioAerResult.percent)}
                </td>
                {/* cols 12-14: Cash DPS, CDS Account, Remarks */}
                <td colSpan={3} className="px-4 py-3 border-r border-gray-200"></td>
                {/* col 15: Cash Div */}
                <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                  Rs. {totalCashDiv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {data.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No portfolio data available for the selected date</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-2">Report Notes:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Cost:</strong> Final Average (AV) Cost based on transactions up to the selected date</li>
              <li><strong>Market price per share:</strong> Latest updated market value from CSE</li>
              <li><strong>Market Value (Net):</strong> Balance shares × market price × (1 − brokerage fee rate)</li>
              <li><strong>Total Returns:</strong> Market value (net) + Total sale proceeds + Dividends − Total cost paid (includes realized gains from sells)</li>
              <li><strong>AER (column):</strong> Annual Equivalent Return for that one share — XIRR of its cash flows (buys as outflows, sells &amp; dividends as inflows, market value net of brokerage as terminal inflow). Shows <strong>—</strong> when no rate solves, e.g. the holding has no market price</li>
              <li><strong>Portfolio AER (total row):</strong> a single XIRR over every holding's pooled cash flows, including positions already sold in full. It is <em>not</em> the sum or the average of the column above, and it will not equal any individual share's AER</li>
              <li><strong>Cash DPS (Net) Last FY:</strong> Editable — enter the cash dividend per share for the last financial year. Cash Div column = Balance Shares × Cash DPS entered.</li>
              <li><strong>Remarks:</strong> Editable — free-text remarks per holding. Click the cell to type.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
