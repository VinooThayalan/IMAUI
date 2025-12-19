import { FileText, Calendar, Filter, PieChart, BarChart3, Printer, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ShareHolding {
  share_id: string;
  symbol: string;
  company_name: string;
  total_shares: number;
  avg_cost: number;
  total_cost: number;
  current_price: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
}

interface PortfolioHolding {
  entity_id: string;
  entity_name: string;
  holdings: {
    symbol: string;
    company_name: string;
    shares: number;
    cost_basis: number;
    current_value: number;
  }[];
  total_cost: number;
  total_value: number;
  gain_loss: number;
}

type ReportType = 'share' | 'portfolio' | null;

export function Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [shareData, setShareData] = useState<ShareHolding[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(false);

  async function generateShareReport() {
    try {
      setLoading(true);

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select(`
          share_id,
          transaction_type,
          no_of_shares,
          price_per_share,
          total_amount,
          shares (
            id,
            symbol,
            company_name
          )
        `);

      if (txError) throw txError;

      const { data: prices, error: priceError } = await supabase
        .from('daily_share_prices')
        .select('share_id, share_price, effective_date')
        .order('effective_date', { ascending: false });

      if (priceError) throw priceError;

      const latestPrices = new Map<string, number>();
      prices?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const shareMap = new Map<string, {
        symbol: string;
        company_name: string;
        total_shares: number;
        total_cost: number;
        transactions: { type: string; shares: number; price: number }[];
      }>();

      transactions?.forEach((tx: any) => {
        if (!tx.shares) return;

        const shareId = tx.share_id;
        if (!shareMap.has(shareId)) {
          shareMap.set(shareId, {
            symbol: tx.shares.symbol,
            company_name: tx.shares.company_name,
            total_shares: 0,
            total_cost: 0,
            transactions: []
          });
        }

        const share = shareMap.get(shareId)!;
        if (tx.transaction_type === 'Buy') {
          share.total_shares += Number(tx.no_of_shares);
          share.total_cost += Number(tx.total_amount);
        } else if (tx.transaction_type === 'Sell') {
          share.total_shares -= Number(tx.no_of_shares);
          share.total_cost -= Number(tx.total_amount);
        }
      });

      const shareHoldings: ShareHolding[] = Array.from(shareMap.entries())
        .map(([shareId, data]) => {
          const avgCost = data.total_shares > 0 ? data.total_cost / data.total_shares : 0;
          const currentPrice = latestPrices.get(data.symbol) || avgCost;
          const currentValue = data.total_shares * currentPrice;
          const gainLoss = currentValue - data.total_cost;
          const gainLossPercent = data.total_cost > 0 ? (gainLoss / data.total_cost) * 100 : 0;

          return {
            share_id: shareId,
            symbol: data.symbol,
            company_name: data.company_name,
            total_shares: data.total_shares,
            avg_cost: avgCost,
            total_cost: data.total_cost,
            current_price: currentPrice,
            current_value: currentValue,
            gain_loss: gainLoss,
            gain_loss_percent: gainLossPercent
          };
        })
        .filter(h => h.total_shares > 0)
        .sort((a, b) => a.symbol.localeCompare(b.symbol));

      setShareData(shareHoldings);
      setActiveReport('share');
    } catch (error) {
      console.error('Error generating share report:', error);
      alert('Failed to generate share report');
    } finally {
      setLoading(false);
    }
  }

  async function generatePortfolioReport() {
    try {
      setLoading(true);

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select(`
          entity_id,
          share_id,
          transaction_type,
          no_of_shares,
          price_per_share,
          total_amount,
          entities (
            id,
            name
          ),
          shares (
            id,
            symbol,
            company_name
          )
        `);

      if (txError) throw txError;

      const { data: prices, error: priceError } = await supabase
        .from('daily_share_prices')
        .select('share_id, share_price, effective_date')
        .order('effective_date', { ascending: false });

      if (priceError) throw priceError;

      const latestPrices = new Map<string, number>();
      prices?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const entityMap = new Map<string, {
        entity_name: string;
        shares: Map<string, {
          symbol: string;
          company_name: string;
          total_shares: number;
          total_cost: number;
          avg_price: number;
        }>;
      }>();

      transactions?.forEach((tx: any) => {
        if (!tx.entities || !tx.shares) return;

        const entityId = tx.entity_id;
        const shareId = tx.share_id;

        if (!entityMap.has(entityId)) {
          entityMap.set(entityId, {
            entity_name: tx.entities.name,
            shares: new Map()
          });
        }

        const entity = entityMap.get(entityId)!;
        if (!entity.shares.has(shareId)) {
          entity.shares.set(shareId, {
            symbol: tx.shares.symbol,
            company_name: tx.shares.company_name,
            total_shares: 0,
            total_cost: 0,
            avg_price: 0
          });
        }

        const share = entity.shares.get(shareId)!;
        if (tx.transaction_type === 'Buy') {
          share.total_shares += Number(tx.no_of_shares);
          share.total_cost += Number(tx.total_amount);
        } else if (tx.transaction_type === 'Sell') {
          share.total_shares -= Number(tx.no_of_shares);
          share.total_cost -= Number(tx.total_amount);
        }
        share.avg_price = share.total_shares > 0 ? share.total_cost / share.total_shares : 0;
      });

      const portfolioHoldings: PortfolioHolding[] = Array.from(entityMap.entries())
        .map(([entityId, data]) => {
          const holdings = Array.from(data.shares.entries())
            .map(([shareId, share]) => {
              const currentPrice = latestPrices.get(share.symbol) || share.avg_price;
              const currentValue = share.total_shares * currentPrice;

              return {
                symbol: share.symbol,
                company_name: share.company_name,
                shares: share.total_shares,
                cost_basis: share.total_cost,
                current_value: currentValue
              };
            })
            .filter(h => h.shares > 0);

          const totalCost = holdings.reduce((sum, h) => sum + h.cost_basis, 0);
          const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);
          const gainLoss = totalValue - totalCost;

          return {
            entity_id: entityId,
            entity_name: data.entity_name,
            holdings,
            total_cost: totalCost,
            total_value: totalValue,
            gain_loss: gainLoss
          };
        })
        .filter(p => p.holdings.length > 0)
        .sort((a, b) => a.entity_name.localeCompare(b.entity_name));

      setPortfolioData(portfolioHoldings);
      setActiveReport('portfolio');
    } catch (error) {
      console.error('Error generating portfolio report:', error);
      alert('Failed to generate portfolio report');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function closeReport() {
    setActiveReport(null);
  }

  if (activeReport === 'share') {
    return (
      <div className="p-8">
        <style>
          {`
            @media print {
              .no-print { display: none !important; }
              body { background: white; }
            }
          `}
        </style>

        <div className="no-print mb-6 flex items-center justify-between">
          <button
            onClick={closeReport}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <X className="w-5 h-5" />
            <span>Close</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="w-5 h-5" />
            <span>Print</span>
          </button>
        </div>

        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Holdings Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
          </div>

          <table className="w-full mb-8">
            <thead className="border-b-2 border-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Symbol</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Company</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Shares</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Avg Cost</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total Cost</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Current Price</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Current Value</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Gain/Loss</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shareData.map((share) => (
                <tr key={share.share_id}>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{share.symbol}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{share.company_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {share.total_shares.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    Rs. {share.avg_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    Rs. {share.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    Rs. {share.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                    Rs. {share.current_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${share.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Rs. {share.gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${share.gain_loss_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {share.gain_loss_percent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-900">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  Totals:
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  Rs. {shareData.reduce((sum, s) => sum + s.total_cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  Rs. {shareData.reduce((sum, s) => sum + s.current_value, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`px-4 py-3 text-sm font-bold text-right ${
                  shareData.reduce((sum, s) => sum + s.gain_loss, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rs. {shareData.reduce((sum, s) => sum + s.gain_loss, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-8 pt-8 border-t border-gray-300 text-sm text-gray-600">
            <p>Total Holdings: {shareData.length} shares</p>
            <p className="mt-2">
              Overall Performance:
              <span className={`ml-2 font-semibold ${
                shareData.reduce((sum, s) => sum + s.gain_loss, 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {((shareData.reduce((sum, s) => sum + s.gain_loss, 0) / shareData.reduce((sum, s) => sum + s.total_cost, 0)) * 100).toFixed(2)}%
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeReport === 'portfolio') {
    return (
      <div className="p-8">
        <style>
          {`
            @media print {
              .no-print { display: none !important; }
              body { background: white; }
            }
          `}
        </style>

        <div className="no-print mb-6 flex items-center justify-between">
          <button
            onClick={closeReport}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <X className="w-5 h-5" />
            <span>Close</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="w-5 h-5" />
            <span>Print</span>
          </button>
        </div>

        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio Holdings Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
          </div>

          {portfolioData.map((entity, idx) => (
            <div key={entity.entity_id} className={idx > 0 ? 'mt-8 pt-8 border-t-2 border-gray-300' : ''}>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{entity.entity_name}</h2>

              <table className="w-full mb-6">
                <thead className="border-b-2 border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Symbol</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Company</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Shares</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Cost Basis</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Current Value</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entity.holdings.map((holding) => (
                    <tr key={`${entity.entity_id}-${holding.symbol}`}>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{holding.symbol}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{holding.company_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {holding.shares.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        Rs. {holding.cost_basis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                        Rs. {holding.current_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${
                        (holding.current_value - holding.cost_basis) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Rs. {(holding.current_value - holding.cost_basis).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-700">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      Entity Total:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      Rs. {entity.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      Rs. {entity.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-3 text-sm font-bold text-right ${
                      entity.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Rs. {entity.gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          <div className="mt-8 pt-8 border-t-2 border-gray-900">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Portfolio Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Cost Basis</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rs. {portfolioData.reduce((sum, p) => sum + p.total_cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Current Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rs. {portfolioData.reduce((sum, p) => sum + p.total_value, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Gain/Loss</p>
                <p className={`text-2xl font-bold ${
                  portfolioData.reduce((sum, p) => sum + p.gain_loss, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rs. {portfolioData.reduce((sum, p) => sum + p.gain_loss, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Overall Return</p>
                <p className={`text-2xl font-bold ${
                  portfolioData.reduce((sum, p) => sum + p.gain_loss, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {((portfolioData.reduce((sum, p) => sum + p.gain_loss, 0) / portfolioData.reduce((sum, p) => sum + p.total_cost, 0)) * 100).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">Generate comprehensive investment reports</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Filter</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Date Range</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Share Holdings Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              Complete breakdown of all share holdings with cost basis, current values, and performance metrics
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Updated: Today
              </div>
              <button
                onClick={generateShareReport}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <PieChart className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Portfolio Holdings Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              Entity-wise portfolio breakdown with valuations, allocations, and performance analysis
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Updated: Today
              </div>
              <button
                onClick={generatePortfolioReport}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate Your Reports</h3>
        <p className="text-gray-500">
          Click on any report above to generate detailed insights about your investments
        </p>
      </div>
    </div>
  );
}
