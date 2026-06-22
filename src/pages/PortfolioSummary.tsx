import { ArrowUpDown, Download, FileText, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

// XIRR: annualized internal rate of return for irregular cash flows
function xirr(cashFlows: Array<{ date: Date; amount: number }>, guess = 0.1): number {
  if (cashFlows.length < 2) return 0;

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const d0 = sorted[0].date.getTime();
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

  let rate = guess;
  for (let iter = 0; iter < 200; iter++) {
    let f = 0;
    let df = 0;
    for (const cf of sorted) {
      const t = (cf.date.getTime() - d0) / MS_PER_YEAR;
      const base = 1 + rate;
      if (base <= 0) break;
      const pv = Math.pow(base, t);
      f += cf.amount / pv;
      df -= (t * cf.amount) / (pv * base);
    }
    if (Math.abs(df) < 1e-12) break;
    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < 1e-8) return newRate;
    rate = Math.max(-0.999, newRate); // clamp to avoid log(0)
  }
  return rate;
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
  market_value_gross: number;
  div: number;
  total_returns: number;
  aer: number;
  cash_dps_last_fy: number;
  cash_div: number;
  remarks: string;
}

type SortField = Exclude<keyof PortfolioRow, 'cds_accounts'>;
type SortDirection = 'asc' | 'desc';

export function PortfolioSummary() {
  const [data, setData] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('entity_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  useEffect(() => {
    fetchPortfolioData();
  }, [asOfDate]);

  async function fetchPortfolioData() {
    try {
      setLoading(true);

      const [transactionsRes, pricesRes, dividendsRes, entitiesRes, sharesRes, openingRes, notesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id,
            entity_id,
            share_id,
            transaction_type,
            no_of_shares,
            total_amount,
            transaction_date,
            approval_status,
            cds_account_id,
            entities ( name, entity_id ),
            shares ( ticker, share_name, sector, sector_types ( sector_name ) )
          `)
          .lte('transaction_date', asOfDate)
          .in('approval_status', ['MANUAL_APPROVED'])
          .order('transaction_date', { ascending: true }),
        supabase
          .from('daily_share_prices')
          .select('share_id, share_price, effective_date')
          .lte('effective_date', asOfDate)
          .order('effective_date', { ascending: false }),
        supabase
          .from('dividends')
          .select('share_id, entity_id, amount_net, net_dividend_per_share, payment_date')
          .lte('payment_date', asOfDate),
        supabase.from('entities').select('id, name, entity_id'),
        supabase.from('shares').select('id, ticker, share_name, sector, sector_types(sector_name)'),
        supabase
          .from('entity_share_opening_balances')
          .select('entity_id, share_id, opening_shares, average_purchase_cost, effective_date')
          .lte('effective_date', asOfDate),
        supabase
          .from('buy_sell_notes')
          .select('transaction_id, note_type, trade_date, no_of_shares, gross_amount')
          .lte('trade_date', asOfDate)
          .order('trade_date', { ascending: true }),
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;

      const latestPrices = new Map<string, number>();
      (pricesRes.data || []).forEach((p: { share_id: string; share_price: number }) => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, Number(p.share_price) || 0);
        }
      });

      const entityMap = new Map<string, { name: string; entity_id: string }>();
      (entitiesRes.data || []).forEach((e: { id: string; name: string; entity_id: string }) => {
        entityMap.set(e.id, { name: e.name, entity_id: e.entity_id });
      });

      const shareMap = new Map<string, { ticker: string; name: string; sector: string }>();
      (sharesRes.data || []).forEach((s: {
        id: string;
        ticker: string;
        share_name: string;
        sector?: string;
        sector_types?: { sector_name: string } | null;
      }) => {
        shareMap.set(s.id, {
          ticker: s.ticker,
          name: s.share_name,
          sector: s.sector_types?.sector_name || s.sector || 'N/A',
        });
      });

      type Holding = {
        entity_id: string;
        entity_name: string;
        share_id: string;
        shares: number;
        cost: number;
      };

      const holdingsMap = new Map<string, Holding>();
      const cdsSetMap = new Map<string, Set<string>>(); // key: entity_id_share_id
      // Cash flows per entity+share for XIRR: negative = money out (buy), positive = money in (sell/div/terminal)
      const cashFlowsMap = new Map<string, Array<{ date: Date; amount: number }>>();

      function ensureHolding(entityId: string, shareId: string, entityName?: string): Holding {
        const key = `${entityId}_${shareId}`;
        if (!holdingsMap.has(key)) {
          const entity = entityMap.get(entityId);
          holdingsMap.set(key, {
            entity_id: entityId,
            entity_name: entityName || entity?.name || 'Unknown',
            share_id: shareId,
            shares: 0,
            cost: 0,
          });
        }
        return holdingsMap.get(key)!;
      }

      function recordCds(entityId: string, shareId: string, cdsAccountId: string | null | undefined) {
        if (!cdsAccountId) return;
        const key = `${entityId}_${shareId}`;
        if (!cdsSetMap.has(key)) cdsSetMap.set(key, new Set());
        cdsSetMap.get(key)!.add(cdsAccountId);
      }

      function ensureCashFlows(entityId: string, shareId: string): Array<{ date: Date; amount: number }> {
        const key = `${entityId}_${shareId}`;
        if (!cashFlowsMap.has(key)) cashFlowsMap.set(key, []);
        return cashFlowsMap.get(key)!;
      }

      function applyBuy(holding: Holding, shares: number, amount: number) {
        holding.shares += shares;
        holding.cost += amount;
      }

      function applySell(holding: Holding, shares: number) {
        const avgCost = holding.shares > 0 ? holding.cost / holding.shares : 0;
        holding.shares = Math.max(0, holding.shares - shares);
        holding.cost = Math.max(0, holding.cost - avgCost * shares);
      }

      // Opening balances
      (openingRes.data || []).forEach((ob: {
        entity_id: string;
        share_id: string;
        opening_shares: number;
        average_purchase_cost: number;
        effective_date: string;
      }) => {
        const holding = ensureHolding(ob.entity_id, ob.share_id, undefined);
        const shares = Number(ob.opening_shares) || 0;
        const cost = shares * (Number(ob.average_purchase_cost) || 0);
        applyBuy(holding, shares, cost);

        if (cost > 0 && ob.effective_date) {
          ensureCashFlows(ob.entity_id, ob.share_id).push({
            date: new Date(ob.effective_date),
            amount: -cost, // money out
          });
        }
      });

      const noteByTxn = new Map<string, { shares: number; gross: number; note_type: string; trade_date: string | null }>();
      (notesRes.data || []).forEach((n: {
        transaction_id: string;
        note_type: string;
        no_of_shares: number;
        gross_amount: number;
        trade_date: string | null;
      }) => {
        noteByTxn.set(n.transaction_id, {
          shares: Number(n.no_of_shares) || 0,
          gross: Number(n.gross_amount) || 0,
          note_type: n.note_type,
          trade_date: n.trade_date,
        });
      });

      (transactionsRes.data || []).forEach((tx: {
        id: string;
        entity_id: string;
        share_id: string;
        transaction_type: string;
        no_of_shares: number;
        total_amount: number;
        transaction_date: string;
        cds_account_id?: string | null;
        entities?: { name: string; entity_id: string } | null;
        shares?: {
          ticker: string;
          share_name: string;
          sector?: string;
          sector_types?: { sector_name: string } | null;
        } | null;
      }) => {
        if (!shareMap.has(tx.share_id) && tx.shares) {
          shareMap.set(tx.share_id, {
            ticker: tx.shares.ticker,
            name: tx.shares.share_name,
            sector: tx.shares.sector_types?.sector_name || tx.shares.sector || 'N/A',
          });
        }

        recordCds(tx.entity_id, tx.share_id, tx.cds_account_id);
        const holding = ensureHolding(tx.entity_id, tx.share_id, tx.entities?.name);

        const note = noteByTxn.get(tx.id);
        const shares = note ? note.shares : Number(tx.no_of_shares) || 0;
        const amount = note ? note.gross : Number(tx.total_amount) || 0;
        const txType = note?.note_type || tx.transaction_type;
        const isBuy = (txType || '').toUpperCase() === 'BUY';
        const txDate = note?.trade_date || tx.transaction_date;

        if (isBuy) {
          applyBuy(holding, shares, amount);
          if (amount > 0 && txDate) {
            ensureCashFlows(tx.entity_id, tx.share_id).push({
              date: new Date(txDate),
              amount: -amount, // money out
            });
          }
        } else {
          applySell(holding, shares);
          if (amount > 0 && txDate) {
            ensureCashFlows(tx.entity_id, tx.share_id).push({
              date: new Date(txDate),
              amount: +amount, // money in
            });
          }
        }
      });

      // Build dividend map and add to cash flows
      const dividendMap = new Map<string, { total: number; dps_last_fy: number }>();
      (dividendsRes.data || []).forEach((div: {
        entity_id: string;
        share_id: string;
        amount_net: number;
        net_dividend_per_share?: number;
        payment_date?: string;
      }) => {
        const key = `${div.entity_id}_${div.share_id}`;
        if (!dividendMap.has(key)) {
          dividendMap.set(key, { total: 0, dps_last_fy: 0 });
        }
        const divData = dividendMap.get(key)!;
        const net = Number(div.amount_net) || 0;
        divData.total += net;
        if (div.net_dividend_per_share != null) {
          divData.dps_last_fy = Number(div.net_dividend_per_share);
        }
        // Add dividend as positive cash flow for XIRR
        if (net > 0 && div.payment_date) {
          ensureCashFlows(div.entity_id, div.share_id).push({
            date: new Date(div.payment_date),
            amount: +net,
          });
        }
      });

      const terminalDate = new Date(asOfDate);

      const portfolioData: PortfolioRow[] = Array.from(holdingsMap.entries())
        .map(([key, holding]) => {
          if (holding.shares <= 0) return null;

          const share = shareMap.get(holding.share_id);
          const marketPrice = latestPrices.get(holding.share_id) || 0;
          const costPerShare = holding.shares > 0 ? holding.cost / holding.shares : 0;
          const marketValueGross = holding.shares * marketPrice;

          const divData = dividendMap.get(key) || { total: 0, dps_last_fy: 0 };
          const totalReturns = marketValueGross - holding.cost + divData.total;

          // XIRR: add terminal value (current market value) as final positive cash flow
          const cfs = ensureCashFlows(holding.entity_id, holding.share_id);
          let aerPct = 0;
          if (marketValueGross > 0 && cfs.length > 0) {
            const xirrFlows = [
              ...cfs,
              { date: terminalDate, amount: marketValueGross },
            ];
            try {
              const rate = xirr(xirrFlows);
              aerPct = isFinite(rate) ? rate * 100 : 0;
            } catch {
              aerPct = 0;
            }
          }

          const cashDiv = holding.shares * divData.dps_last_fy;

          const cdsKey = `${holding.entity_id}_${holding.share_id}`;
          const cdsAccounts = cdsSetMap.has(cdsKey) ? Array.from(cdsSetMap.get(cdsKey)!) : [];

          return {
            entity_id: holding.entity_id,
            entity_name: holding.entity_name,
            cds_accounts: cdsAccounts,
            sector: share?.sector || 'N/A',
            share_id: holding.share_id,
            ticker: share?.ticker || 'N/A',
            share_name: share?.name || 'N/A',
            balance_shares: holding.shares,
            cost: holding.cost,
            cost_per_share: costPerShare,
            market_price_per_share: marketPrice,
            market_value_gross: marketValueGross,
            div: divData.total,
            total_returns: totalReturns,
            aer: aerPct,
            cash_dps_last_fy: divData.dps_last_fy,
            cash_div: cashDiv,
            remarks: '',
          };
        })
        .filter((row): row is PortfolioRow => row !== null);

      setData(portfolioData);
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
            ['Entity','Sector','Share','Balance Shares','Cost','Cost per Share','Market Price per Share','Div','Total Returns','AER %','Cash DPS (net) last FY','CDS Account','Remarks','Cash Div'],
            getSortedData().map(r => [
              r.entity_name, r.sector, r.ticker, r.balance_shares,
              r.cost.toFixed(2), r.cost_per_share.toFixed(2), r.market_price_per_share.toFixed(2),
              r.div.toFixed(2), r.total_returns.toFixed(2), r.aer.toFixed(2) + '%',
              r.cash_dps_last_fy.toFixed(2), r.cds_accounts.join('; '), r.remarks || '', r.cash_div.toFixed(2),
            ])
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
              <p className="text-lg font-bold text-gray-900">Rs. {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Total Returns</p>
              <p className={`text-lg font-bold ${totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Rs. {totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
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
                <SortableHeader field="div">Div</SortableHeader>
                <SortableHeader field="total_returns">Total Returns</SortableHeader>
                <SortableHeader field="aer">AER %</SortableHeader>
                <SortableHeader field="cash_dps_last_fy">cash DPS (net) last FY</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200">CDS Account</th>
                <SortableHeader field="remarks">Remarks</SortableHeader>
                <SortableHeader field="cash_div">Cash div</SortableHeader>
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
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                    Rs. {row.div.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-bold border-r border-gray-200 ${row.total_returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Rs. {row.total_returns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold border-r border-gray-200 ${row.aer >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.aer.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                    Rs. {row.cash_dps_last_fy.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 font-mono">
                    {row.cds_accounts.length > 0
                      ? row.cds_accounts.map((cds, i) => <div key={i}>{cds}</div>)
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{row.remarks || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                    Rs. {row.cash_div.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr className="font-bold">
                <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">TOTAL</td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                  Rs. {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2} className="px-4 py-3 border-r border-gray-200"></td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                  Rs. {totalDiv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`px-4 py-3 text-sm text-right border-r border-gray-200 ${totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Rs. {totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={4} className="px-4 py-3 border-r border-gray-200"></td>
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
              <li><strong>Total Returns:</strong> Market value (gross) - Total AV cost + Dividends</li>
              <li><strong>AER:</strong> Annual Equivalent Return — XIRR of all cash flows (buys as outflows, sells &amp; dividends as inflows, current market value as terminal inflow)</li>
              <li><strong>Cash DPS (net) last FY:</strong> Dividend per share based on shares held at dividend date</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
