import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart } from './PieChart';

interface SectorData {
  sector: string;
  totalReturns: number;
  totalDividends: number;
  marketValue: number;
}

const SECTOR_COLORS: Record<string, string> = {
  'Banking': '#3B82F6',
  'Diversified Financials': '#10B981',
  'Hotels': '#F59E0B',
  'Industries': '#EC4899',
  'Construction Materials': '#8B5CF6',
  'Automobile Components': '#EF4444',
  'Telecommunication': '#06B6D4',
  'Manufacturing': '#F97316',
  'Technology': '#6366F1',
  'Healthcare': '#14B8A6',
  'Energy': '#F43F5E',
  'Consumer Goods': '#84CC16',
  'Retail': '#A855F7',
  'Insurance': '#0EA5E9',
  'Real Estate': '#22C55E',
  'Other': '#6B7280'
};

function getColorForSector(sector: string): string {
  return SECTOR_COLORS[sector] || SECTOR_COLORS['Other'];
}

export function SectorAnalytics() {
  const [loading, setLoading] = useState(true);
  const [sectorData, setSectorData] = useState<SectorData[]>([]);

  useEffect(() => {
    fetchSectorData();
  }, []);

  async function fetchSectorData() {
    try {
      setLoading(true);

      const [transactionsRes, pricesRes, sharesRes, dividendsRes] = await Promise.all([
        supabase.from('transactions').select('share_id, transaction_type, no_of_shares, total_amount'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('shares').select('id, sector'),
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

      const shareToSector = new Map<string, string>();
      sharesRes.data?.forEach(s => {
        shareToSector.set(s.id, s.sector || 'Other');
      });

      const holdingsMap = new Map<string, { holdings: number; cost: number }>();

      transactionsRes.data?.forEach((tx: { share_id: string; transaction_type: string; no_of_shares: number; total_amount: number }) => {
        if (!holdingsMap.has(tx.share_id)) {
          holdingsMap.set(tx.share_id, { holdings: 0, cost: 0 });
        }

        const data = holdingsMap.get(tx.share_id)!;
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';

        if (isBuy) {
          data.holdings += Number(tx.no_of_shares);
          data.cost += Number(tx.total_amount);
        } else {
          const soldShares = Number(tx.no_of_shares);
          const avgCost = data.holdings > 0 ? data.cost / data.holdings : 0;
          data.holdings -= soldShares;
          data.cost -= avgCost * soldShares;
          if (data.holdings < 0) data.holdings = 0;
          if (data.cost < 0) data.cost = 0;
        }
      });

      const sectorMap = new Map<string, { cost: number; marketValue: number; dividends: number }>();

      holdingsMap.forEach((data, shareId) => {
        if (data.holdings > 0) {
          const sector = shareToSector.get(shareId) || 'Other';
          if (!sectorMap.has(sector)) {
            sectorMap.set(sector, { cost: 0, marketValue: 0, dividends: 0 });
          }
          const sEntry = sectorMap.get(sector)!;
          const currentPrice = latestPrices.get(shareId) || 0;
          sEntry.cost += data.cost;
          sEntry.marketValue += data.holdings * currentPrice;
        }
      });

      dividendsRes.data?.forEach((div: { share_id: string; amount_net: number }) => {
        const sector = shareToSector.get(div.share_id) || 'Other';
        if (sectorMap.has(sector)) {
          sectorMap.get(sector)!.dividends += Number(div.amount_net);
        }
      });

      const result: SectorData[] = [];
      sectorMap.forEach((data, sector) => {
        if (data.marketValue > 0 || data.cost > 0) {
          result.push({
            sector,
            totalReturns: data.marketValue - data.cost + data.dividends,
            totalDividends: data.dividends,
            marketValue: data.marketValue
          });
        }
      });

      setSectorData(result);
    } catch (error) {
      console.error('Error fetching sector data:', error);
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

  const totalReturnsData = sectorData.map(d => ({
    label: d.sector,
    value: d.totalReturns,
    color: getColorForSector(d.sector),
    percentage: 0
  }));

  const totalReturns = totalReturnsData.reduce((sum, d) => sum + d.value, 0);
  totalReturnsData.forEach(d => {
    d.percentage = totalReturns > 0 ? (d.value / totalReturns) * 100 : 0;
  });

  const totalDividendsData = sectorData.map(d => ({
    label: d.sector,
    value: d.totalDividends,
    color: getColorForSector(d.sector),
    percentage: 0
  }));

  const totalDividends = totalDividendsData.reduce((sum, d) => sum + d.value, 0);
  totalDividendsData.forEach(d => {
    d.percentage = totalDividends > 0 ? (d.value / totalDividends) * 100 : 0;
  });

  const marketValueData = sectorData.map(d => ({
    label: d.sector,
    value: d.marketValue,
    color: getColorForSector(d.sector),
    percentage: 0
  }));

  const totalMarketValue = marketValueData.reduce((sum, d) => sum + d.value, 0);
  marketValueData.forEach(d => {
    d.percentage = totalMarketValue > 0 ? (d.value / totalMarketValue) * 100 : 0;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Total Returns on Balance Shares by Sector</h2>
        <p className="text-sm text-gray-500 mt-1">Portfolio breakdown by sector with returns, dividends, and market value analysis</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="lg:col-span-2 flex justify-center">
            <PieChart
              data={totalReturnsData}
              title="Total Returns on Bal. Shares by Sector"
              size={280}
            />
          </div>

          <div className="flex justify-center">
            <PieChart
              data={totalDividendsData}
              title="Total Dividends by Sector"
              size={220}
            />
          </div>

          <div className="flex justify-center">
            <PieChart
              data={marketValueData}
              title="Market Value of Share Portfolio by Sector"
              size={220}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
