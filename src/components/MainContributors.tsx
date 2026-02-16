import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart } from './PieChart';

interface ShareData {
  ticker: string;
  netMarketValue: number;
  totalDividends: number;
  totalReturns: number;
  totalCost: number;
}

const SHARE_COLORS = [
  '#1E293B',
  '#3B82F6',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#14B8A6'
];

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rs.${(value / 1_000_000_000).toFixed(2)}bn`;
  } else if (value >= 1_000_000) {
    return `Rs.${(value / 1_000_000).toFixed(2)}m`;
  } else if (value >= 1_000) {
    return `Rs.${(value / 1_000).toFixed(2)}k`;
  }
  return `Rs.${value.toFixed(2)}`;
}

export function MainContributors() {
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareData[]>([]);

  useEffect(() => {
    fetchShareData();
  }, []);

  async function fetchShareData() {
    try {
      setLoading(true);

      const [transactionsRes, pricesRes, sharesRes, dividendsRes] = await Promise.all([
        supabase.from('transactions').select('share_id, transaction_type, no_of_shares, total_amount, price_per_share'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('shares').select('id, ticker'),
        supabase.from('dividends').select('share_id, amount_net')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      const latestPrices = new Map<string, number>();
      pricesRes.data?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const shareToTicker = new Map<string, string>();
      sharesRes.data?.forEach(s => {
        shareToTicker.set(s.id, s.ticker);
      });

      const shareMap = new Map<string, { holdings: number; cost: number; dividends: number; ticker: string }>();

      transactionsRes.data?.forEach((tx: any) => {
        const ticker = shareToTicker.get(tx.share_id);
        if (!ticker) return;

        if (!shareMap.has(tx.share_id)) {
          shareMap.set(tx.share_id, { holdings: 0, cost: 0, dividends: 0, ticker });
        }

        const data = shareMap.get(tx.share_id)!;
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';

        if (isBuy) {
          data.holdings += Number(tx.no_of_shares);
          data.cost += Number(tx.total_amount);
        } else {
          data.holdings -= Number(tx.no_of_shares);
          if (data.holdings >= 0) {
            const avgCost = data.cost / (data.holdings + Number(tx.no_of_shares));
            data.cost -= avgCost * Number(tx.no_of_shares);
          }
        }
      });

      dividendsRes.data?.forEach((div: any) => {
        if (shareMap.has(div.share_id)) {
          shareMap.get(div.share_id)!.dividends += Number(div.amount_net);
        }
      });

      const result: ShareData[] = [];
      shareMap.forEach((data, shareId) => {
        if (data.holdings > 0) {
          const currentPrice = latestPrices.get(shareId) || 0;
          const marketValue = data.holdings * currentPrice;
          const totalReturns = marketValue - data.cost + data.dividends;

          result.push({
            ticker: data.ticker,
            netMarketValue: marketValue,
            totalDividends: data.dividends,
            totalReturns,
            totalCost: data.cost
          });
        }
      });

      result.sort((a, b) => b.netMarketValue - a.netMarketValue);
      setShareData(result.slice(0, 10));
    } catch (error) {
      console.error('Error fetching share data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const netMarketData = shareData.map((d, i) => ({
    label: d.ticker,
    value: d.netMarketValue,
    color: SHARE_COLORS[i % SHARE_COLORS.length],
    percentage: 0
  }));

  const totalNetMarket = netMarketData.reduce((sum, d) => sum + d.value, 0);
  netMarketData.forEach(d => {
    d.percentage = totalNetMarket > 0 ? (d.value / totalNetMarket) * 100 : 0;
  });

  const dividendsData = shareData.map((d, i) => ({
    label: d.ticker,
    value: d.totalDividends,
    color: SHARE_COLORS[i % SHARE_COLORS.length],
    percentage: 0
  }));

  const totalDividends = dividendsData.reduce((sum, d) => sum + d.value, 0);
  dividendsData.forEach(d => {
    d.percentage = totalDividends > 0 ? (d.value / totalDividends) * 100 : 0;
  });

  const returnsData = shareData.map((d, i) => ({
    label: d.ticker,
    value: d.totalReturns,
    color: SHARE_COLORS[i % SHARE_COLORS.length],
    percentage: 0
  }));

  const totalReturns = returnsData.reduce((sum, d) => sum + d.value, 0);
  returnsData.forEach(d => {
    d.percentage = totalReturns > 0 ? (d.value / totalReturns) * 100 : 0;
  });

  const costData = shareData.map((d, i) => ({
    label: d.ticker,
    value: d.totalCost,
    color: SHARE_COLORS[i % SHARE_COLORS.length],
    percentage: 0
  }));

  const totalCost = costData.reduce((sum, d) => sum + d.value, 0);
  costData.forEach(d => {
    d.percentage = totalCost > 0 ? (d.value / totalCost) * 100 : 0;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
        <h2 className="text-2xl font-bold text-gray-900">Main Contributors Report</h2>
        <p className="text-sm text-gray-600 mt-1">Top performing shares across key metrics</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-base font-bold text-red-600 mb-6">Total Net Market by Share</h3>
            <PieChart data={netMarketData} title="" size={240} />
            <div className="mt-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalNetMarket)}</p>
              <p className="text-xs text-gray-500">Total Market Value</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-base font-bold text-red-600 mb-6">Total Dividends by Share</h3>
            <PieChart data={dividendsData} title="" size={240} />
            <div className="mt-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalDividends)}</p>
              <p className="text-xs text-gray-500">Total Dividends</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-base font-bold text-red-600 mb-6">Total Returns by Share</h3>
            <PieChart data={returnsData} title="" size={240} />
            <div className="mt-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalReturns)}</p>
              <p className="text-xs text-gray-500">Total Returns</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-base font-bold text-red-600 mb-6">Total Cost by Share</h3>
            <PieChart data={costData} title="" size={240} />
            <div className="mt-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCost)}</p>
              <p className="text-xs text-gray-500">Total Cost</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
