import { ArrowUpDown, Download, FileText, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatAer, portfolioAer, type CashFlow, type PortfolioAerResult } from '../lib/aer';
import * as sourceFingerprintRepo from '../repositories/sourceFingerprint.repo';
import * as analyticsCacheRepo from '../repositories/analyticsCache.repo';
import { summaryInWindow } from '../services/portfolioSummary.service';

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
  const [fromDate, setFromDate] = useState<string>('');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  // Editable overrides: key = entity_id_share_id
  const [editedDps, setEditedDps]       = useState<Map<string, string>>(new Map());
  const [editedRemarks, setEditedRemarks] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchPortfolioData();
  }, [asOfDate, fromDate]);

  async function fetchPortfolioData() {
    try {
      setLoading(true);

      const sourceHash = await sourceFingerprintRepo.current();
      const cacheRows = await analyticsCacheRepo.findByHash(sourceHash);

      if (cacheRows.length === 0) {
        setData([]);
        setAerInputs([]);
        return;
      }

      // The window rule lives in the service. This page only says which window.
      const { rows: summaryRows, aerPositions } = summaryInWindow(
        cacheRows,
        { from: fromDate, to: asOfDate },
      );

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

      const portfolioData: PortfolioRow[] = summaryRows.map(r => {
        const dps = dpsMap.get(`${r.entityId}_${r.shareId}`) ?? 0;
        return {
          entity_id: r.entityId,
          entity_name: r.entityName,
          cds_accounts: r.cdsAccounts,
          sector: shareSectorMap.get(r.shareId) || 'N/A',
          share_id: r.shareId,
          ticker: r.ticker,
          share_name: r.shareName,
          balance_shares: r.balanceShares,
          cost: r.cost,
          cost_per_share: r.costPerShare,
          market_price_per_share: r.marketPricePerShare,
          market_value_net: r.marketValueNet,
          div: r.div,
          total_returns: r.totalReturns,
          // Left null when there is no solution. Coercing it to 0 rendered an
          // uncomputable return as a green 0.00%, indistinguishable from a real
          // flat return — which is how broken inputs stayed invisible here.
          aer: r.aer,
          cash_dps_last_fy: dps,
          cash_div: r.balanceShares * dps,
          remarks: '',
        };
      });

      const aerRows: AerInput[] = aerPositions.map(p => ({
        entity_id: summaryRows.find(r => r.ticker === p.label)?.entityId ?? '',
        ticker: p.label,
        cashFlows: p.cashFlows,
        heldShares: p.heldShares,
        marketPrice: p.marketPrice,
        brokerageFeeRate: p.brokerageFeeRate,
      }));

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
                <label className="text-sm font-medium text-gray-700 mr-2">As of Date (to):</label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="ps-from" className="text-sm font-medium text-gray-700">From:</label>
              <input
                id="ps-from"
                type="date"
                value={fromDate}
                max={asOfDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {fromDate && (
                <button
                  onClick={() => setFromDate('')}
                  className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
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

        {(fromDate || asOfDate) && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            Balance, Cost, Market Value and Total Returns are <strong>as at {new Date(asOfDate + 'T00:00:00').toLocaleDateString('en-GB')}</strong>; anything traded later is excluded.
            {fromDate && (
              <> The <strong>Div</strong> column covers <strong>{new Date(fromDate + 'T00:00:00').toLocaleDateString('en-GB')} onward</strong> only. <strong>Total Returns stays measured from acquisition</strong> — it includes the market value of what is still held, so a period figure would need the position's value on the start date, which needs a historic price. The two columns therefore differ on purpose while a start date is set.</>
            )}
            {' '}Shares are valued at the latest market price on file, not the price on the as-at date.
          </div>
        )}

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
