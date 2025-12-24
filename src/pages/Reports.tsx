import { FileText, Calendar, Filter, PieChart, BarChart3, Printer, X, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ShareHolding {
  share_id: string;
  symbol: string;
  name: string;
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
  cds_account: string;
  holdings: {
    sector: string;
    symbol: string;
    name: string;
    balance: number;
    cost: number;
    cost_per_share: number;
    market_price_per_share: number;
    market_value_net: number;
    dividends: number;
    cash_dps_net: number;
    total_returns: number;
    aer: number;
    remarks: string;
  }[];
  total_cost: number;
  total_value: number;
  total_dividends: number;
  total_returns: number;
  gain_loss: number;
}

interface DetailedShareTransaction {
  entity_name: string;
  share_symbol: string;
  share_name: string;
  date: string;
  status: string;
  unit_price: number;
  no_of_shares: number;
  share_cum_balance: number;
  purchase_cost: number;
  sales_value: number;
  avg_cost: number;
  avg_price: number;
  dividend: number;
  market_value: number;
  cash_flow: number;
  total_surplus: number;
  cum_surplus: number;
  cds_account: string;
  cost_per_share: number;
  market_price: number;
  market_price_after_brokerage: number;
  sale_value: number;
  purchase_value: number;
  annual_equivalent_rate: number;
}

interface CashbookEntry {
  date: string;
  description: string;
  code: string;
  amount: number;
  type: 'in' | 'out';
}

interface CashbookReport {
  entries_in: CashbookEntry[];
  entries_out: CashbookEntry[];
  total_in: number;
  total_out: number;
  opening_balance: number;
  closing_balance: number;
}

type ReportType = 'share' | 'portfolio' | 'detailed' | 'cashbook' | null;

export function Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [shareData, setShareData] = useState<ShareHolding[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioHolding[]>([]);
  const [detailedData, setDetailedData] = useState<DetailedShareTransaction[]>([]);
  const [cashbookData, setCashbookData] = useState<CashbookReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedEntityName, setSelectedEntityName] = useState<string>('All Entities');

  useEffect(() => {
    fetchEntities();
  }, []);

  async function fetchEntities() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  }

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
            name
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
        name: string;
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
            name: tx.shares.name,
            total_shares: 0,
            total_cost: 0,
            transactions: []
          });
        }

        const share = shareMap.get(shareId)!;
        if (tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy') {
          share.total_shares += Number(tx.no_of_shares);
          share.total_cost += Number(tx.total_amount);
        } else if (tx.transaction_type === 'SELL' || tx.transaction_type === 'Sell') {
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
            name: data.name,
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

      const [transactionsRes, dividendsRes, pricesRes, entitiesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            entity_id,
            share_id,
            transaction_type,
            transaction_date,
            no_of_shares,
            price_per_share,
            total_amount,
            entities (
              id,
              name,
              entity_id
            ),
            shares (
              id,
              symbol,
              name,
              sector
            )
          `)
          .order('transaction_date', { ascending: true }),
        supabase
          .from('dividends')
          .select('entity_id, share_id, payment_date, amount_net, amount_gross')
          .order('payment_date', { ascending: false }),
        supabase
          .from('daily_share_prices')
          .select('share_id, share_price, effective_date')
          .order('effective_date', { ascending: false }),
        supabase.from('entities').select('id, name, entity_id')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (dividendsRes.error) throw dividendsRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (entitiesRes.error) throw entitiesRes.error;

      const latestPrices = new Map<string, number>();
      pricesRes.data?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const dividendMap = new Map<string, { total: number; count: number; lastFY: number }>();
      dividendsRes.data?.forEach(d => {
        const key = `${d.entity_id}-${d.share_id}`;
        const current = dividendMap.get(key) || { total: 0, count: 0, lastFY: 0 };
        current.total += Number(d.amount_net);
        current.count += 1;
        if (current.count === 1) {
          current.lastFY = Number(d.amount_net);
        }
        dividendMap.set(key, current);
      });

      const entityMap = new Map<string, {
        entity_name: string;
        cds_account: string;
        shares: Map<string, {
          sector: string;
          symbol: string;
          name: string;
          total_shares: number;
          total_cost: number;
          first_tx_date: string;
        }>;
      }>();

      transactionsRes.data?.forEach((tx: any) => {
        if (!tx.entities || !tx.shares) return;

        const entityId = tx.entity_id;
        const shareId = tx.share_id;

        if (!entityMap.has(entityId)) {
          entityMap.set(entityId, {
            entity_name: tx.entities.name,
            cds_account: tx.entities.entity_id || '',
            shares: new Map()
          });
        }

        const entity = entityMap.get(entityId)!;
        if (!entity.shares.has(shareId)) {
          entity.shares.set(shareId, {
            sector: tx.shares.sector || 'N/A',
            symbol: tx.shares.symbol,
            name: tx.shares.name,
            total_shares: 0,
            total_cost: 0,
            first_tx_date: tx.transaction_date
          });
        }

        const share = entity.shares.get(shareId)!;
        if (tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy') {
          share.total_shares += Number(tx.no_of_shares);
          share.total_cost += Number(tx.total_amount);
        } else if (tx.transaction_type === 'SELL' || tx.transaction_type === 'Sell') {
          share.total_shares -= Number(tx.no_of_shares);
          share.total_cost -= Number(tx.total_amount);
        }
      });

      const portfolioHoldings: PortfolioHolding[] = Array.from(entityMap.entries())
        .map(([entityId, data]) => {
          const holdings = Array.from(data.shares.entries())
            .map(([shareId, share]) => {
              const marketPrice = latestPrices.get(shareId) || 0;
              const costPerShare = share.total_shares > 0 ? share.total_cost / share.total_shares : 0;
              const marketValueNet = share.total_shares * marketPrice;

              const divKey = `${entityId}-${shareId}`;
              const divData = dividendMap.get(divKey) || { total: 0, count: 0, lastFY: 0 };
              const totalDividends = divData.total;
              const cashDpsNet = share.total_shares > 0 ? divData.lastFY / share.total_shares : 0;

              const totalReturns = (marketValueNet - share.total_cost) + totalDividends;

              const daysSinceFirst = Math.max(1, Math.floor((new Date().getTime() - new Date(share.first_tx_date).getTime()) / (1000 * 60 * 60 * 24)));
              const aer = share.total_cost > 0 ? (totalReturns / share.total_cost) * (365 / daysSinceFirst) * 100 : 0;

              return {
                sector: share.sector,
                symbol: share.symbol,
                name: share.name,
                balance: share.total_shares,
                cost: share.total_cost,
                cost_per_share: costPerShare,
                market_price_per_share: marketPrice,
                market_value_net: marketValueNet,
                dividends: totalDividends,
                cash_dps_net: cashDpsNet,
                total_returns: totalReturns,
                aer: aer,
                remarks: ''
              };
            })
            .filter(h => h.balance > 0);

          const totalCost = holdings.reduce((sum, h) => sum + h.cost, 0);
          const totalValue = holdings.reduce((sum, h) => sum + h.market_value_net, 0);
          const totalDividends = holdings.reduce((sum, h) => sum + h.dividends, 0);
          const totalReturns = holdings.reduce((sum, h) => sum + h.total_returns, 0);
          const gainLoss = totalValue - totalCost;

          return {
            entity_id: entityId,
            entity_name: data.entity_name,
            cds_account: data.cds_account,
            holdings,
            total_cost: totalCost,
            total_value: totalValue,
            total_dividends: totalDividends,
            total_returns: totalReturns,
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

  async function generateDetailedShareReport() {
    try {
      setLoading(true);

      const [transactionsRes, dividendsRes, pricesRes, entitiesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id,
            entity_id,
            share_id,
            transaction_type,
            transaction_date,
            no_of_shares,
            price_per_share,
            total_amount,
            fees,
            entities (
              id,
              name,
              entity_id
            ),
            shares (
              id,
              symbol,
              name
            )
          `)
          .order('transaction_date', { ascending: true }),
        supabase
          .from('dividends')
          .select('entity_id, share_id, payment_date, amount_net')
          .order('payment_date', { ascending: true }),
        supabase
          .from('daily_share_prices')
          .select('share_id, share_price, effective_date')
          .order('effective_date', { ascending: false }),
        supabase.from('entities').select('id, name, entity_id')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (dividendsRes.error) throw dividendsRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (entitiesRes.error) throw entitiesRes.error;

      const latestPrices = new Map<string, number>();
      pricesRes.data?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const dividendMap = new Map<string, number>();
      dividendsRes.data?.forEach(d => {
        const key = `${d.entity_id}-${d.share_id}`;
        dividendMap.set(key, (dividendMap.get(key) || 0) + Number(d.amount_net));
      });

      const balanceTracker = new Map<string, number>();
      const costTracker = new Map<string, number>();
      let cumulativeSurplus = 0;

      const detailedTransactions: DetailedShareTransaction[] = [];

      transactionsRes.data?.forEach((tx: any) => {
        if (!tx.entities || !tx.shares) return;

        const key = `${tx.entity_id}-${tx.share_id}`;
        const currentBalance = balanceTracker.get(key) || 0;
        const currentCost = costTracker.get(key) || 0;

        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        const shares = Number(tx.no_of_shares);
        const price = Number(tx.price_per_share);
        const totalAmount = Number(tx.total_amount);
        const fees = Number(tx.fees) || 0;

        const newBalance = isBuy ? currentBalance + shares : currentBalance - shares;
        const newCost = isBuy ? currentCost + totalAmount : currentCost - (currentBalance > 0 ? (currentCost / currentBalance) * shares : 0);

        balanceTracker.set(key, newBalance);
        costTracker.set(key, newCost);

        const avgCost = newBalance > 0 ? newCost / newBalance : 0;
        const marketPrice = latestPrices.get(tx.share_id) || price;
        const brokerageRate = 0.003;
        const marketPriceAfterBrokerage = isBuy
          ? marketPrice * (1 + brokerageRate)
          : marketPrice * (1 - brokerageRate);

        const marketValue = newBalance * marketPrice;
        const cashFlow = isBuy ? -totalAmount : totalAmount;
        const totalSurplus = marketValue - newCost;
        cumulativeSurplus += (isBuy ? 0 : totalAmount - (avgCost * shares));

        const dividend = dividendMap.get(key) || 0;
        const daysSinceStart = Math.max(1, Math.floor((new Date().getTime() - new Date(tx.transaction_date).getTime()) / (1000 * 60 * 60 * 24)));
        const annualEquivalentRate = newCost > 0 ? (totalSurplus / newCost) * (365 / daysSinceStart) * 100 : 0;

        detailedTransactions.push({
          entity_name: tx.entities.name,
          share_symbol: tx.shares.symbol,
          share_name: tx.shares.name,
          date: tx.transaction_date,
          status: tx.transaction_type,
          unit_price: price,
          no_of_shares: shares,
          share_cum_balance: newBalance,
          purchase_cost: isBuy ? totalAmount : 0,
          sales_value: isBuy ? 0 : totalAmount,
          avg_cost: avgCost,
          avg_price: avgCost,
          dividend: dividend,
          market_value: marketValue,
          cash_flow: cashFlow,
          total_surplus: totalSurplus,
          cum_surplus: cumulativeSurplus,
          cds_account: tx.entities.entity_id || '',
          cost_per_share: avgCost,
          market_price: marketPrice,
          market_price_after_brokerage: marketPriceAfterBrokerage,
          sale_value: isBuy ? 0 : totalAmount,
          purchase_value: isBuy ? totalAmount : 0,
          annual_equivalent_rate: annualEquivalentRate
        });
      });

      setDetailedData(detailedTransactions);
      setActiveReport('detailed');
    } catch (error) {
      console.error('Error generating detailed share report:', error);
      alert('Failed to generate detailed share report');
    } finally {
      setLoading(false);
    }
  }

  async function generateCashbookReport() {
    try {
      setLoading(true);

      let query = supabase
        .from('cash_balance_ledger')
        .select('*')
        .order('date', { ascending: true });

      if (selectedEntity !== 'all') {
        query = query.eq('entity_id', selectedEntity);
      }

      const { data: ledger, error } = await query;

      if (error) throw error;

      const entriesIn: CashbookEntry[] = [];
      const entriesOut: CashbookEntry[] = [];
      let openingBalance = 0;

      ledger?.forEach((entry: any, index: number) => {
        const entryData: CashbookEntry = {
          date: new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }),
          description: entry.description || '',
          code: entry.code || (entry.type === 'Addition' ? '001' : '002'),
          amount: Number(entry.amount),
          type: entry.type === 'Addition' ? 'in' : 'out'
        };

        if (index === 0 && entry.type === 'Addition') {
          openingBalance = Number(entry.amount);
          entryData.description = `Balance b/f ${entryData.description}`;
        }

        if (entry.type === 'Addition') {
          entriesIn.push(entryData);
        } else {
          entriesOut.push(entryData);
        }
      });

      const totalIn = entriesIn.reduce((sum, e) => sum + e.amount, 0);
      const totalOut = entriesOut.reduce((sum, e) => sum + e.amount, 0);
      const closingBalance = totalIn - totalOut;

      if (closingBalance !== 0) {
        entriesOut.push({
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }),
          description: 'Balance carried forward',
          code: '',
          amount: closingBalance,
          type: 'out'
        });
      }

      setCashbookData({
        entries_in: entriesIn,
        entries_out: entriesOut,
        total_in: totalIn,
        total_out: totalIn,
        opening_balance: openingBalance,
        closing_balance: closingBalance
      });
      setActiveReport('cashbook');
    } catch (error) {
      console.error('Error generating cashbook report:', error);
      alert('Failed to generate cashbook report');
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
                  <td className="px-4 py-3 text-sm text-gray-900">{share.name}</td>
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

  if (activeReport === 'detailed') {
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

        <div className="bg-white p-8 rounded-lg border border-gray-200 overflow-x-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Detailed Share Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b-2 border-gray-900">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Entity</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Share</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Date</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Status</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Unit Price</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Shares</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Cum Bal</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Purchase Cost</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Sales Value</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Avg Cost</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Dividend</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Market Value</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Cash Flow</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Total Surplus</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Cum Surplus</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">CDS</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Market Price</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Price + Brok.</th>
                <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">AER %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {detailedData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-xs text-gray-900">{row.entity_name}</td>
                  <td className="px-2 py-2 text-xs font-medium text-gray-900">{row.share_symbol}</td>
                  <td className="px-2 py-2 text-xs text-gray-900">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      row.status === 'BUY' || row.status === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">{row.unit_price.toFixed(2)}</td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">{row.no_of_shares.toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-gray-900 text-right">{row.share_cum_balance.toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">
                    {row.purchase_cost > 0 ? row.purchase_cost.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">
                    {row.sales_value > 0 ? row.sales_value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">{row.avg_cost.toFixed(2)}</td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">
                    {row.dividend > 0 ? row.dividend.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-gray-900 text-right">
                    {row.market_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`px-2 py-2 text-xs font-semibold text-right ${
                    row.cash_flow >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {row.cash_flow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`px-2 py-2 text-xs font-semibold text-right ${
                    row.total_surplus >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {row.total_surplus.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`px-2 py-2 text-xs font-semibold text-right ${
                    row.cum_surplus >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {row.cum_surplus.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-900">{row.cds_account}</td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">{row.market_price.toFixed(2)}</td>
                  <td className="px-2 py-2 text-xs text-gray-900 text-right">{row.market_price_after_brokerage.toFixed(2)}</td>
                  <td className={`px-2 py-2 text-xs font-semibold text-right ${
                    row.annual_equivalent_rate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {row.annual_equivalent_rate.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {detailedData.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No transactions found</p>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-gray-300 text-sm text-gray-600">
            <p>Total Transactions: {detailedData.length}</p>
            <p className="mt-2">
              Final Cumulative Surplus:
              <span className={`ml-2 font-semibold text-lg ${
                detailedData.length > 0 && detailedData[detailedData.length - 1].cum_surplus >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                Rs. {detailedData.length > 0 ? detailedData[detailedData.length - 1].cum_surplus.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeReport === 'cashbook') {
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Cash Book</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            <p className="text-sm text-gray-500 mt-1">Entity: {selectedEntityName}</p>
          </div>

          {cashbookData && (
            <div className="grid grid-cols-2 gap-1 border-2 border-gray-900">
              <div className="border-r border-gray-900">
                <table className="w-full">
                  <thead className="bg-emerald-50 border-b-2 border-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-900 border-r border-gray-300">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-900 border-r border-gray-300">Description</th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-300">Code</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-900">Amount In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashbookData.entries_in.map((entry, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="px-3 py-2 text-xs text-gray-900 border-r border-gray-200">{entry.date}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 border-r border-gray-200">{entry.description}</td>
                        <td className="px-3 py-2 text-xs text-center text-gray-900 border-r border-gray-200">{entry.code}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right font-medium">{entry.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 border-t-2 border-gray-900">
                      <td colSpan={3} className="px-3 py-3 text-sm font-bold text-gray-900 text-center border-r border-gray-300">Total funds</td>
                      <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{cashbookData.total_in.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <table className="w-full">
                  <thead className="bg-orange-50 border-b-2 border-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-900 border-r border-gray-300">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-900 border-r border-gray-300">Description</th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-300">Code</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-900">Amounts out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashbookData.entries_out.map((entry, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="px-3 py-2 text-xs text-gray-900 border-r border-gray-200">{entry.date}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 border-r border-gray-200">{entry.description}</td>
                        <td className="px-3 py-2 text-xs text-center text-gray-900 border-r border-gray-200">{entry.code}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right font-medium">{entry.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-orange-50 border-t-2 border-gray-900">
                      <td colSpan={3} className="px-3 py-3 text-sm font-bold text-gray-900 text-center border-r border-gray-300">Total funds</td>
                      <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{cashbookData.total_out.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!cashbookData && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No cash transactions found</p>
            </div>
          )}
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
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{entity.entity_name}</h2>
                <div className="text-sm text-gray-600">CDS Account: <span className="font-semibold">{entity.cds_account}</span></div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full mb-6 text-sm">
                  <thead className="bg-gray-50 border-b-2 border-gray-700">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Sector</th>
                      <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Share</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Balance</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Cost</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Cost/Share</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Mkt Price</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Mkt Value</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Div</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">Total Returns</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">AER %</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-900">DPS (FY)</th>
                      <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entity.holdings.map((holding) => (
                      <tr key={`${entity.entity_id}-${holding.symbol}`} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-xs text-gray-900">{holding.sector}</td>
                        <td className="px-2 py-2 text-xs font-bold text-gray-900">{holding.symbol}</td>
                        <td className="px-2 py-2 text-xs text-gray-900 text-right">
                          {holding.balance.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900 text-right">
                          {holding.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900 text-right">
                          {holding.cost_per_share.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900 text-right">
                          {holding.market_price_per_share.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-xs font-semibold text-gray-900 text-right">
                          {holding.market_value_net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900 text-right">
                          {holding.dividends > 0 ? holding.dividends.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className={`px-2 py-2 text-xs font-semibold text-right ${
                          holding.total_returns >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {holding.total_returns.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`px-2 py-2 text-xs font-semibold text-right ${
                          holding.aer >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {holding.aer.toFixed(2)}%
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900 text-right">
                          {holding.cash_dps_net > 0 ? holding.cash_dps_net.toFixed(2) : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-500">{holding.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-700 bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-2 py-3 text-xs font-bold text-gray-900 text-right">
                        Entity Total:
                      </td>
                      <td className="px-2 py-3 text-xs font-bold text-gray-900 text-right">
                        {entity.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} className="px-2 py-3"></td>
                      <td className="px-2 py-3 text-xs font-bold text-gray-900 text-right">
                        {entity.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-3 text-xs font-bold text-gray-900 text-right">
                        {entity.total_dividends.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-2 py-3 text-xs font-bold text-right ${
                        entity.total_returns >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entity.total_returns.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={3} className="px-2 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          <div className="mt-8 pt-8 border-t-2 border-gray-900">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Portfolio Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Cost Basis</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rs. {portfolioData.reduce((sum, p) => sum + p.total_cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Market Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rs. {portfolioData.reduce((sum, p) => sum + p.total_value, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Dividends</p>
                <p className="text-2xl font-bold text-blue-600">
                  Rs. {portfolioData.reduce((sum, p) => sum + p.total_dividends, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Returns</p>
                <p className={`text-2xl font-bold ${
                  portfolioData.reduce((sum, p) => sum + p.total_returns, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rs. {portfolioData.reduce((sum, p) => sum + p.total_returns, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Capital Gain/Loss</p>
                <p className={`text-2xl font-bold ${
                  portfolioData.reduce((sum, p) => sum + p.gain_loss, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rs. {portfolioData.reduce((sum, p) => sum + p.gain_loss, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Overall Return %</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-orange-50 text-orange-700 rounded">
                Detailed
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Detailed Share Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              Transaction-level analysis with cumulative balances, surplus calculations, and annual equivalent rates
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Updated: Today
              </div>
              <button
                onClick={generateDetailedShareReport}
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
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cash Book Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              Double-entry cashbook showing all cash inflows and outflows with running balances
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">Select Entity</label>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedEntity(value);
                  if (value === 'all') {
                    setSelectedEntityName('All Entities');
                  } else {
                    const entity = entities.find(ent => ent.id === value);
                    setSelectedEntityName(entity?.name || 'Unknown');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Entities</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Updated: Today
              </div>
              <button
                onClick={generateCashbookReport}
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
