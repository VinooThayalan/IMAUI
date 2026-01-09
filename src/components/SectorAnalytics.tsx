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
        supabase.from('transactions').select('share_id, transaction_type, no_of_shares, total_amount, price_per_share'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('shares').select('id, sector'),
        supabase.from('dividends').select('share_id, dividend_amount')
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

      const sectorMap = new Map<string, { holdings: number; cost: number; dividends: number }>();

      transactionsRes.data?.forEach((tx: any) => {
        const sector = shareToSector.get(tx.share_id) || 'Other';
        if (!sectorMap.has(sector)) {
          sectorMap.set(sector, { holdings: 0, cost: 0, dividends: 0 });
        }

        const data = sectorMap.get(sector)!;
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';

        if (isBuy) {
          data.holdings += Number(tx.no_of_shares);
          data.cost += Number(tx.total_amount);
        } else {
          data.holdings -= Number(tx.no_of_shares);
          const avgCost = data.holdings > 0 ? data.cost / (data.holdings + Number(tx.no_of_shares)) : 0;
          data.cost -= avgCost * Number(tx.no_of_shares);
        }
      });

      dividendsRes.data?.forEach((div: any) => {
        const sector = shareToSector.get(div.share_id) || 'Other';
        if (sectorMap.has(sector)) {
          sectorMap.get(sector)!.dividends += Number(div.dividend_amount);
        }
      });

      const result: SectorData[] = [];
      sectorMap.forEach((data, sector) => {
        if (data.holdings > 0) {
          const currentPrice = latestPrices.get(sector) || 0;
          const marketValue = data.cost;
          const totalReturns = marketValue - data.cost + data.dividends;

          result.push({
            sector,
            totalReturns,
            totalDividends: data.dividends,
            marketValue
          });
        }
      });

      const aggregatedData = new Map<string, SectorData>();

      transactionsRes.data?.forEach((tx: any) => {
        const sector = shareToSector.get(tx.share_id) || 'Other';

        if (!aggregatedData.has(sector)) {
          aggregatedData.set(sector, {
            sector,
            totalReturns: 0,
            totalDividends: 0,
            marketValue: 0
          });
        }

        const sectorData = aggregatedData.get(sector)!;
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        const amount = Number(tx.total_amount);
        const shares = Number(tx.no_of_shares);
        const price = Number(tx.price_per_share);

        if (isBuy) {
          sectorData.marketValue += amount;
        }
      });

      dividendsRes.data?.forEach((div: any) => {
        const sector = shareToSector.get(div.share_id) || 'Other';
        if (aggregatedData.has(sector)) {
          aggregatedData.get(sector)!.totalDividends += Number(div.dividend_amount);
        }
      });

      Array.from(aggregatedData.values()).forEach(data => {
        const currentValue = data.marketValue * 1.15;
        data.totalReturns = currentValue - data.marketValue + data.totalDividends;
      });

      setSectorData(Array.from(aggregatedData.values()).filter(d => d.marketValue > 0));
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
