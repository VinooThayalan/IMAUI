import { ArrowUpDown, Download, FileText, Filter, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface PortfolioRow {
  entity_id: string;
  entity_name: string;
  cds_account: string;
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
  aer: number;
  cash_dps_last_fy: number;
  cash_div: number;
  remarks: string;
}

type SortField = keyof PortfolioRow;
type SortDirection = 'asc' | 'desc';

export function PortfolioSummary() {
  const [data, setData] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('entity_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchPortfolioData();
  }, [asOfDate]);

  async function fetchPortfolioData() {
    try {
      setLoading(true);

      const [transactionsRes, pricesRes, dividendsRes, entitiesRes, sharesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('entity_id, share_id, transaction_type, no_of_shares, total_amount, transaction_date, price_per_share')
          .lte('transaction_date', asOfDate),
        supabase
          .from('daily_share_prices')
          .select('share_id, share_price, effective_date')
          .lte('effective_date', asOfDate)
          .order('effective_date', { ascending: false }),
        supabase
          .from('dividends')
          .select('share_id, entity_id, dividend_per_share, total_dividend_amount, ex_dividend_date')
          .lte('ex_dividend_date', asOfDate),
        supabase.from('entities').select('id, name, entity_id'),
        supabase.from('shares').select('id, ticker, share_name, sector_types(name)')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (dividendsRes.error) throw dividendsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      const latestPrices = new Map<string, number>();
      pricesRes.data?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const entityMap = new Map<string, any>();
      entitiesRes.data?.forEach(e => {
        entityMap.set(e.id, { name: e.name, entity_id: e.entity_id });
      });

      const shareMap = new Map<string, any>();
      sharesRes.data?.forEach(s => {
        shareMap.set(s.id, {
          ticker: s.ticker,
          name: s.share_name,
          sector: s.sector_types?.name || 'N/A'
        });
      });

      const holdingsMap = new Map<string, {
        entity_id: string;
        entity_name: string;
        cds_account: string;
        share_id: string;
        shares: number;
        cost: number;
      }>();

      transactionsRes.data?.forEach((tx: any) => {
        const key = `${tx.entity_id}_${tx.share_id}`;
        if (!holdingsMap.has(key)) {
          const entity = entityMap.get(tx.entity_id);
          holdingsMap.set(key, {
            entity_id: tx.entity_id,
            entity_name: entity?.name || 'Unknown',
            cds_account: entity?.entity_id || '',
            share_id: tx.share_id,
            shares: 0,
            cost: 0
          });
        }

        const holding = holdingsMap.get(key)!;
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        const shares = Number(tx.no_of_shares);
        const amount = Number(tx.total_amount);

        if (isBuy) {
          holding.shares += shares;
          holding.cost += amount;
        } else {
          holding.shares -= shares;
          const avgCost = holding.shares > 0 ? holding.cost / (holding.shares + shares) : 0;
          holding.cost -= avgCost * shares;
        }
      });

      const dividendMap = new Map<string, { total: number; dps_last_fy: number }>();
      dividendsRes.data?.forEach((div: any) => {
        const key = `${div.entity_id}_${div.share_id}`;
        if (!dividendMap.has(key)) {
          dividendMap.set(key, { total: 0, dps_last_fy: 0 });
        }
        const divData = dividendMap.get(key)!;
        divData.total += Number(div.total_dividend_amount);
        divData.dps_last_fy = Number(div.dividend_per_share);
      });

      const portfolioData: PortfolioRow[] = Array.from(holdingsMap.entries())
        .map(([key, holding]) => {
          if (holding.shares <= 0) return null;

          const share = shareMap.get(holding.share_id);
          const marketPrice = latestPrices.get(holding.share_id) || 0;
          const costPerShare = holding.shares > 0 ? holding.cost / holding.shares : 0;
          const marketValueGross = holding.shares * marketPrice;
          const brokerageCost = marketValueGross * 0.0025;
          const marketValueNet = marketValueGross - brokerageCost;

          const divData = dividendMap.get(key) || { total: 0, dps_last_fy: 0 };
          const totalReturns = marketValueNet - holding.cost + divData.total;
          const aer = holding.cost > 0 ? (totalReturns / holding.cost) * 100 : 0;
          const cashDiv = holding.shares * divData.dps_last_fy;

          return {
            entity_id: holding.entity_id,
            entity_name: holding.entity_name,
            cds_account: holding.cds_account,
            sector: share?.sector || 'N/A',
            share_id: holding.share_id,
            ticker: share?.ticker || 'N/A',
            share_name: share?.name || 'N/A',
            balance_shares: holding.shares,
            cost: holding.cost,
            cost_per_share: costPerShare,
            market_price_per_share: marketPrice,
            market_value_net: marketValueNet,
            div: divData.total,
            total_returns: totalReturns,
            aer: aer,
            cash_dps_last_fy: divData.dps_last_fy,
            cash_div: cashDiv,
            remarks: ''
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

  function getSortedData(): PortfolioRow[] {
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
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

  const totalCost = data.reduce((sum, row) => sum + row.cost, 0);
  const totalMarketValue = data.reduce((sum, row) => sum + row.market_value_net, 0);
  const totalReturns = data.reduce((sum, row) => sum + row.total_returns, 0);
  const totalDiv = data.reduce((sum, row) => sum + row.div, 0);
  const totalCashDiv = data.reduce((sum, row) => sum + row.cash_div, 0);

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
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
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
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Total Cost</p>
              <p className="text-lg font-bold text-gray-900">Rs. {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Market Value</p>
              <p className="text-lg font-bold text-gray-900">Rs. {totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
                <SortableHeader field="market_value_net">Market value (net)</SortableHeader>
                <SortableHeader field="div">Div</SortableHeader>
                <SortableHeader field="total_returns">Total Returns</SortableHeader>
                <SortableHeader field="aer">AER %</SortableHeader>
                <SortableHeader field="cash_dps_last_fy">cash DPS (net) last FY</SortableHeader>
                <SortableHeader field="cds_account">CDS Account</SortableHeader>
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
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 border-r border-gray-200">
                    Rs. {row.market_value_net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{row.cds_account || 'N/A'}</td>
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
                  Rs. {totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
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
              <li><strong>Market price per share:</strong> Latest updated market value from CSE (before brokerage adjustments)</li>
              <li><strong>Market value (net):</strong> Market value × number of shares - brokerage cost (2.5%)</li>
              <li><strong>Total Returns:</strong> Market value - Total AV cost + Dividends</li>
              <li><strong>AER:</strong> Absolute Equity Return percentage</li>
              <li><strong>Cash DPS (net) last FY:</strong> Dividend per share based on shares held at dividend date</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
