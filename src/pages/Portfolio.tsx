import { PieChart, TrendingUp, TrendingDown, Wallet, Percent, Download } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
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

interface PortfolioSummary {
  totalValue: number;
  totalGainLoss: number;
  percentChange: number;
  cashBalance: number;
}

interface SectorRow {
  sector: string;
  value: number;
  percentage: number;
  color: string;
}

interface EntityRow {
  name: string;
  value: number;
  percentage: number;
  shares: number;
}

interface PerformerRow {
  ticker: string;
  name: string;
  gainLoss: number;
  percentage: number;
}

const SECTOR_BAR_COLORS: Record<string, string> = {
  'Banking': 'bg-blue-600',
  'Diversified Financials': 'bg-green-600',
  'Telecommunications': 'bg-yellow-600',
  'Telecommunication': 'bg-yellow-600',
  'Hotels': 'bg-purple-600',
  'Industries': 'bg-pink-600',
  'Manufacturing': 'bg-gray-600',
  'Power & Energy': 'bg-orange-600',
  'Energy': 'bg-orange-600',
  'Beverages Food & Tobacco': 'bg-teal-600',
  'Insurance': 'bg-indigo-600',
  'Other': 'bg-slate-600',
};

const FALLBACK_COLORS = [
  'bg-blue-600', 'bg-green-600', 'bg-yellow-600', 'bg-red-600',
  'bg-gray-600', 'bg-orange-600', 'bg-teal-600', 'bg-purple-600',
];

function sectorBarColor(sector: string, index: number): string {
  return SECTOR_BAR_COLORS[sector] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function fmtSignedCurrency(value: number): string {
  const prefix = value >= 0 ? '+Rs. ' : '-Rs. ';
  return `${prefix}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtSignedPercent(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

export function Portfolio() {
  const [loading, setLoading] = useState(true);
  const [portfolioData, setPortfolioData] = useState<PortfolioSummary>({
    totalValue: 0,
    totalGainLoss: 0,
    percentChange: 0,
    cashBalance: 0,
  });
  const [sectorAllocation, setSectorAllocation] = useState<SectorRow[]>([]);
  const [entityBreakdown, setEntityBreakdown] = useState<EntityRow[]>([]);
  const [topPerformers, setTopPerformers] = useState<PerformerRow[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<PerformerRow[]>([]);

  const fetchPortfolioData = useCallback(async () => {
    setLoading(true);
    try {
      const [sharesRes, txnsRes, pricesRes, dividendsRes, notesRes, entitiesRes, openingRes] = await Promise.all([
        supabase.from('shares').select('id, ticker, share_name, sector, sector_types(sector_name)').eq('is_active', true),
        supabase
          .from('transactions')
          .select(`
            id, entity_id, share_id, transaction_type, no_of_shares, total_amount, approval_status,
            shares ( ticker, share_name, sector, sector_types ( sector_name ) )
          `)
          .in('approval_status', ['MANUAL_APPROVED'])
          .order('transaction_date', { ascending: true }),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('dividends').select('share_id, amount_net'),
        supabase.from('buy_sell_notes').select('transaction_id, no_of_shares, gross_amount, note_type').not('transaction_id', 'is', null),
        supabase.from('entities').select('id, name, current_balance'),
        supabase.from('entity_share_opening_balances').select('entity_id, share_id, opening_shares, average_purchase_cost'),
      ]);

      if (txnsRes.error) throw txnsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;

      const shareMap = new Map<string, { ticker: string; name: string; sector: string }>();
      (sharesRes.data || []).forEach((s: {
        id: string;
        ticker: string;
        share_name: string;
        sector?: string;
        sector_types?: { sector_name: string } | null;
      }) => {
        shareMap.set(s.id, {
          ticker: s.ticker || '—',
          name: s.share_name || s.ticker || '—',
          sector: s.sector_types?.sector_name || s.sector || 'Other',
        });
      });

      const entityNameMap = new Map<string, string>();
      let cashBalance = 0;
      (entitiesRes.data || []).forEach((e: { id: string; name: string; current_balance: number }) => {
        entityNameMap.set(e.id, e.name);
        cashBalance += Number(e.current_balance) || 0;
      });

      const latestPrices = new Map<string, number>();
      (pricesRes.data || []).forEach((p: { share_id: string; share_price: number }) => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, Number(p.share_price) || 0);
        }
      });

      const divMap = new Map<string, number>();
      (dividendsRes.data || []).forEach((d: { share_id: string; amount_net: number }) => {
        divMap.set(d.share_id, (divMap.get(d.share_id) || 0) + Number(d.amount_net));
      });

      const txnNoteMap = new Map<string, { shares: number; gross: number }>();
      (notesRes.data || []).forEach((n: { transaction_id: string; no_of_shares: number; gross_amount: number }) => {
        txnNoteMap.set(n.transaction_id, {
          shares: Number(n.no_of_shares) || 0,
          gross: Number(n.gross_amount) || 0,
        });
      });

      type HoldingAcc = { held: number; cost: number; totalCostAll: number; saleProceeds: number };
      const shareHoldMap = new Map<string, HoldingAcc>();
      const entityHoldMap = new Map<string, Map<string, HoldingAcc>>();

      function ensureShareHolding(shareId: string): HoldingAcc {
        if (!shareHoldMap.has(shareId)) {
          shareHoldMap.set(shareId, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0 });
        }
        return shareHoldMap.get(shareId)!;
      }

      function ensureEntityHolding(entityId: string, shareId: string): HoldingAcc {
        if (!entityHoldMap.has(entityId)) entityHoldMap.set(entityId, new Map());
        const entityShares = entityHoldMap.get(entityId)!;
        if (!entityShares.has(shareId)) {
          entityShares.set(shareId, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0 });
        }
        return entityShares.get(shareId)!;
      }

      function applyMovement(h: HoldingAcc, sharesQty: number, gross: number, isBuy: boolean) {
        if (isBuy) {
          h.held += sharesQty;
          h.cost += gross;
          h.totalCostAll += gross;
        } else {
          const avgCps = h.held > 0 ? h.cost / h.held : 0;
          const removedCost = avgCps * sharesQty;
          h.held = Math.max(0, h.held - sharesQty);
          h.cost = Math.max(0, h.cost - removedCost);
          h.saleProceeds += gross;
        }
      }

      (openingRes.data || []).forEach((ob: {
        entity_id: string;
        share_id: string;
        opening_shares: number;
        average_purchase_cost: number;
      }) => {
        const sharesQty = Number(ob.opening_shares) || 0;
        const gross = sharesQty * (Number(ob.average_purchase_cost) || 0);
        applyMovement(ensureShareHolding(ob.share_id), sharesQty, gross, true);
        applyMovement(ensureEntityHolding(ob.entity_id, ob.share_id), sharesQty, gross, true);
      });

      (txnsRes.data || []).forEach((tx: {
        id: string;
        entity_id: string;
        share_id: string;
        transaction_type: string;
        no_of_shares: number;
        total_amount: number;
        shares?: {
          ticker: string;
          share_name: string;
          sector?: string;
          sector_types?: { sector_name: string } | null;
        } | null;
      }) => {
        if (!shareMap.has(tx.share_id) && tx.shares) {
          shareMap.set(tx.share_id, {
            ticker: tx.shares.ticker || '—',
            name: tx.shares.share_name || tx.shares.ticker || '—',
            sector: tx.shares.sector_types?.sector_name || tx.shares.sector || 'Other',
          });
        }

        const note = txnNoteMap.get(tx.id);
        const sharesQty = note ? note.shares : Number(tx.no_of_shares) || 0;
        const gross = note ? note.gross : Number(tx.total_amount) || 0;
        const isBuy = (tx.transaction_type || '').toUpperCase() === 'BUY';

        applyMovement(ensureShareHolding(tx.share_id), sharesQty, gross, isBuy);
        applyMovement(ensureEntityHolding(tx.entity_id, tx.share_id), sharesQty, gross, isBuy);
      });

      let totalValue = 0;
      let totalCost = 0;
      let totalGainLoss = 0;

      const sectorMap = new Map<string, number>();
      const performers: PerformerRow[] = [];

      shareHoldMap.forEach((h, shareId) => {
        if (h.held <= 0) return;

        const share = shareMap.get(shareId);
        const price = latestPrices.get(shareId) || 0;
        const marketValue = h.held * price;
        const dividends = divMap.get(shareId) || 0;
        const gainLoss = marketValue - h.cost + dividends;
        const pct = h.cost > 0 ? (gainLoss / h.cost) * 100 : 0;

        totalValue += marketValue;
        totalCost += h.cost;
        totalGainLoss += gainLoss;

        const sector = share?.sector || 'Other';
        sectorMap.set(sector, (sectorMap.get(sector) || 0) + marketValue);

        performers.push({
          ticker: share?.ticker || '—',
          name: share?.name || '—',
          gainLoss,
          percentage: pct,
        });
      });

      performers.sort((a, b) => b.gainLoss - a.gainLoss);
      setTopPerformers(performers.filter(p => p.gainLoss > 0).slice(0, 3));
      setBottomPerformers(
        [...performers].sort((a, b) => a.gainLoss - b.gainLoss).filter(p => p.gainLoss < 0).slice(0, 3)
      );

      const sectors: SectorRow[] = Array.from(sectorMap.entries())
        .map(([sector, value], index) => ({
          sector,
          value,
          percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
          color: sectorBarColor(sector, index),
        }))
        .sort((a, b) => b.value - a.value);
      setSectorAllocation(sectors);

      const entityRows: EntityRow[] = [];
      entityHoldMap.forEach((shareMapForEntity, entityId) => {
        let entityValue = 0;
        let shareCount = 0;

        shareMapForEntity.forEach((h, shareId) => {
          if (h.held <= 0) return;
          entityValue += h.held * (latestPrices.get(shareId) || 0);
          shareCount += 1;
        });

        if (entityValue > 0) {
          entityRows.push({
            name: entityNameMap.get(entityId) || 'Unknown',
            value: entityValue,
            percentage: totalValue > 0 ? (entityValue / totalValue) * 100 : 0,
            shares: shareCount,
          });
        }
      });
      entityRows.sort((a, b) => b.value - a.value);
      setEntityBreakdown(entityRows);

      setPortfolioData({
        totalValue,
        totalGainLoss,
        percentChange: totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0,
        cashBalance,
      });
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  function handleExport() {
    const date = new Date().toISOString().split('T')[0];

    exportCsv(
      `portfolio_sector_allocation_${date}.csv`,
      ['Sector', 'Value (Rs.)', 'Percentage (%)'],
      sectorAllocation.map(s => [s.sector, s.value, s.percentage.toFixed(1)])
    );

    setTimeout(() => {
      exportCsv(
        `portfolio_entity_breakdown_${date}.csv`,
        ['Entity', 'Value (Rs.)', 'Percentage (%)', 'No. of Shares'],
        entityBreakdown.map(e => [e.name, e.value, e.percentage.toFixed(1), e.shares])
      );
    }, 300);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  const gainPositive = portfolioData.totalGainLoss >= 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-gray-500 mt-1">Comprehensive view of your investment portfolio</p>
        </div>
        <button
          onClick={handleExport}
          disabled={sectorAllocation.length === 0 && entityBreakdown.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center mt-2">
                {gainPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ml-1 ${gainPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtSignedPercent(portfolioData.percentChange)}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Gain/Loss</p>
              <p className={`text-2xl font-bold mt-2 ${gainPositive ? 'text-green-600' : 'text-red-600'}`}>
                {fmtSignedCurrency(portfolioData.totalGainLoss)}
              </p>
              <p className="text-sm text-gray-500 mt-2">All time</p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${gainPositive ? 'bg-green-100' : 'bg-red-100'}`}>
              {gainPositive ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Cash Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {portfolioData.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mt-2">Available funds</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Return Rate</p>
              <p className={`text-2xl font-bold mt-2 ${gainPositive ? 'text-green-600' : 'text-red-600'}`}>
                {fmtSignedPercent(portfolioData.percentChange)}
              </p>
              <p className="text-sm text-gray-500 mt-2">On current holdings</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Percent className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Sector Allocation</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {sectorAllocation.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No sector data available</p>
            ) : (
              sectorAllocation.map((sector) => (
                <div key={sector.sector} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${sector.color}`} />
                      <span className="text-sm font-medium text-gray-900">{sector.sector}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        Rs. {sector.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{sector.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${sector.color} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${sector.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Entity Breakdown</h2>
          </div>
          <div className="p-6 space-y-4">
            {entityBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No entity data available</p>
            ) : (
              entityBreakdown.map((entity) => (
                <div key={entity.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{entity.name}</p>
                      <p className="text-xs text-gray-500">{entity.shares} different shares</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        Rs. {entity.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{entity.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${entity.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Top Performers</h2>
          </div>
          <div className="p-6 space-y-4">
            {topPerformers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No positive performers yet</p>
            ) : (
              topPerformers.map((stock, index) => (
                <div key={stock.ticker} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-green-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{stock.ticker}</p>
                      <p className="text-xs text-gray-500">{stock.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{fmtSignedCurrency(stock.gainLoss)}</p>
                    <p className="text-xs font-medium text-green-600">{fmtSignedPercent(stock.percentage)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Bottom Performers</h2>
          </div>
          <div className="p-6 space-y-4">
            {bottomPerformers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No underperformers</p>
            ) : (
              bottomPerformers.map((stock, index) => (
                <div key={stock.ticker} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-red-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{stock.ticker}</p>
                      <p className="text-xs text-gray-500">{stock.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{fmtSignedCurrency(stock.gainLoss)}</p>
                    <p className="text-xs font-medium text-red-600">{fmtSignedPercent(stock.percentage)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
