import { ArrowLeft, ArrowUpDown, Calendar, ChevronRight, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Entity {
  id: string;
  name: string;
  entity_id: string;
  total_investment: number;
  total_value: number;
  total_shares: number;
}

interface ShareDetail {
  share_id: string;
  ticker: string;
  name: string;
  total_shares: number;
  avg_cost: number;
  avg_cost_buy: number;
  avg_cost_sell: number;
  total_cost: number;
  sales_cost: number;
  purchase_value: number;
  sale_value: number;
  cost_per_share: number;
  avg_price: number;
  current_price: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  first_purchase: string;
  last_transaction: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount: number;
  fees: number;
  cumulative_shares: number;
  avg_cost: number;
}

type View = 'entities' | 'shares' | 'transactions';
type SortField = string;
type SortDirection = 'asc' | 'desc';

export function ShareAnalytics() {
  const [currentView, setCurrentView] = useState<View>('entities');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<ShareDetail[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedShare, setSelectedShare] = useState<ShareDetail | null>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (currentView === 'entities') {
      fetchEntities();
    }
  }, [currentView]);

  async function fetchEntities() {
    try {
      setLoading(true);

      const [transactionsRes, pricesRes, entitiesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('entity_id, share_id, transaction_type, no_of_shares, total_amount, transaction_date'),
        supabase
          .from('daily_share_prices')
          .select('share_id, share_price, effective_date')
          .order('effective_date', { ascending: false }),
        supabase.from('entities').select('id, name, entity_id')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (entitiesRes.error) throw entitiesRes.error;

      const latestPrices = new Map<string, number>();
      pricesRes.data?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const entityMap = new Map<string, {
        name: string;
        entity_id: string;
        total_cost: number;
        shares: Map<string, { shares: number; cost: number }>;
      }>();

      transactionsRes.data?.forEach((tx: any) => {
        if (!entityMap.has(tx.entity_id)) {
          const entity = entitiesRes.data?.find(e => e.id === tx.entity_id);
          entityMap.set(tx.entity_id, {
            name: entity?.name || 'Unknown',
            entity_id: entity?.entity_id || '',
            total_cost: 0,
            shares: new Map()
          });
        }

        const entity = entityMap.get(tx.entity_id)!;
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';

        if (!entity.shares.has(tx.share_id)) {
          entity.shares.set(tx.share_id, { shares: 0, cost: 0 });
        }

        const shareData = entity.shares.get(tx.share_id)!;
        if (isBuy) {
          shareData.shares += Number(tx.no_of_shares);
          shareData.cost += Number(tx.total_amount);
          entity.total_cost += Number(tx.total_amount);
        } else {
          shareData.shares -= Number(tx.no_of_shares);
          const avgCost = shareData.cost / (shareData.shares + Number(tx.no_of_shares));
          const costReduction = avgCost * Number(tx.no_of_shares);
          shareData.cost -= costReduction;
          entity.total_cost -= costReduction;
        }
      });

      const entitiesList: Entity[] = Array.from(entityMap.entries())
        .map(([id, data]) => {
          let totalValue = 0;
          let totalShares = 0;

          data.shares.forEach((shareData, shareId) => {
            const price = latestPrices.get(shareId) || 0;
            totalValue += shareData.shares * price;
            totalShares += shareData.shares;
          });

          return {
            id,
            name: data.name,
            entity_id: data.entity_id,
            total_investment: data.total_cost,
            total_value: totalValue,
            total_shares: totalShares
          };
        })
        .filter(e => e.total_shares > 0);

      setEntities(entitiesList);
    } catch (error) {
      console.error('Error fetching entities:', error);
      alert('Failed to fetch entities');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSharesForEntity(entity: Entity) {
    try {
      setLoading(true);
      setSelectedEntity(entity);

      let txQuery = supabase
        .from('transactions')
        .select(`
          share_id,
          transaction_type,
          no_of_shares,
          price_per_share,
          total_amount,
          transaction_date,
          shares (
            id,
            ticker,
            name
          )
        `)
        .eq('entity_id', entity.id);

      if (fromDate) {
        txQuery = txQuery.gte('transaction_date', fromDate);
      }
      if (toDate) {
        txQuery = txQuery.lte('transaction_date', toDate);
      }

      const [transactionsRes, pricesRes] = await Promise.all([
        txQuery,
        supabase
          .from('daily_share_prices')
          .select('share_id, share_price, effective_date')
          .order('effective_date', { ascending: false })
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (pricesRes.error) throw pricesRes.error;

      const latestPrices = new Map<string, number>();
      pricesRes.data?.forEach(p => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, p.share_price);
        }
      });

      const shareMap = new Map<string, {
        ticker: string;
        name: string;
        total_shares: number;
        total_cost: number;
        buy_shares: number;
        buy_cost: number;
        buy_count: number;
        sell_shares: number;
        sell_cost: number;
        sell_count: number;
        total_buy_value: number;
        total_sell_value: number;
        first_purchase: string;
        last_transaction: string;
      }>();

      transactionsRes.data?.forEach((tx: any) => {
        if (!tx.shares) return;

        const shareId = tx.share_id;
        if (!shareMap.has(shareId)) {
          shareMap.set(shareId, {
            ticker: tx.shares.ticker,
            name: tx.shares.name,
            total_shares: 0,
            total_cost: 0,
            buy_shares: 0,
            buy_cost: 0,
            buy_count: 0,
            sell_shares: 0,
            sell_cost: 0,
            sell_count: 0,
            total_buy_value: 0,
            total_sell_value: 0,
            first_purchase: tx.transaction_date,
            last_transaction: tx.transaction_date
          });
        }

        const share = shareMap.get(shareId)!;
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        const shares = Number(tx.no_of_shares);
        const amount = Number(tx.total_amount);

        if (isBuy) {
          share.total_shares += shares;
          share.total_cost += amount;
          share.buy_shares += shares;
          share.buy_cost += amount;
          share.buy_count += 1;
          share.total_buy_value += amount;
        } else {
          share.total_shares -= shares;
          const avgCost = share.total_shares > 0 ? share.total_cost / (share.total_shares + shares) : 0;
          const costReduction = avgCost * shares;
          share.total_cost -= costReduction;
          share.sell_shares += shares;
          share.sell_cost += costReduction;
          share.sell_count += 1;
          share.total_sell_value += amount;
        }

        if (tx.transaction_date < share.first_purchase) {
          share.first_purchase = tx.transaction_date;
        }
        if (tx.transaction_date > share.last_transaction) {
          share.last_transaction = tx.transaction_date;
        }
      });

      const sharesList: ShareDetail[] = Array.from(shareMap.entries())
        .map(([shareId, data]) => {
          const avgCost = data.total_shares > 0 ? data.total_cost / data.total_shares : 0;
          const avgCostBuy = data.buy_shares > 0 ? data.buy_cost / data.buy_shares : 0;
          const avgCostSell = data.sell_shares > 0 ? data.sell_cost / data.sell_shares : 0;
          const currentPrice = latestPrices.get(shareId) || avgCost;
          const currentValue = data.total_shares * currentPrice;
          const gainLoss = currentValue - data.total_cost;
          const gainLossPercent = data.total_cost > 0 ? (gainLoss / data.total_cost) * 100 : 0;
          const costPerShare = avgCost;
          const avgPrice = (data.buy_shares + data.sell_shares) > 0
            ? (data.buy_cost + data.sell_cost) / (data.buy_shares + data.sell_shares)
            : 0;

          return {
            share_id: shareId,
            ticker: data.ticker,
            name: data.name,
            total_shares: data.total_shares,
            avg_cost: avgCost,
            avg_cost_buy: avgCostBuy,
            avg_cost_sell: avgCostSell,
            total_cost: data.total_cost,
            sales_cost: data.sell_cost,
            purchase_value: data.total_buy_value,
            sale_value: data.total_sell_value,
            cost_per_share: costPerShare,
            avg_price: avgPrice,
            current_price: currentPrice,
            current_value: currentValue,
            gain_loss: gainLoss,
            gain_loss_percent: gainLossPercent,
            first_purchase: data.first_purchase,
            last_transaction: data.last_transaction
          };
        })
        .filter(s => s.total_shares > 0);

      setShares(sharesList);
      setCurrentView('shares');
    } catch (error) {
      console.error('Error fetching shares:', error);
      alert('Failed to fetch shares');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTransactionsForShare(share: ShareDetail) {
    try {
      setLoading(true);
      setSelectedShare(share);

      let txQuery = supabase
        .from('transactions')
        .select('*')
        .eq('entity_id', selectedEntity!.id)
        .eq('share_id', share.share_id)
        .order('transaction_date', { ascending: true });

      if (fromDate) {
        txQuery = txQuery.gte('transaction_date', fromDate);
      }
      if (toDate) {
        txQuery = txQuery.lte('transaction_date', toDate);
      }

      const { data, error } = await txQuery;

      if (error) throw error;

      let cumulativeShares = 0;
      let cumulativeCost = 0;

      const transactionsList: Transaction[] = data?.map((tx: any) => {
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        const shares = Number(tx.no_of_shares);
        const amount = Number(tx.total_amount);

        if (isBuy) {
          cumulativeShares += shares;
          cumulativeCost += amount;
        } else {
          cumulativeShares -= shares;
          const avgCost = cumulativeShares > 0 ? cumulativeCost / (cumulativeShares + shares) : 0;
          cumulativeCost -= avgCost * shares;
        }

        const avgCost = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0;

        return {
          id: tx.id,
          transaction_date: tx.transaction_date,
          transaction_type: tx.transaction_type,
          no_of_shares: shares,
          price_per_share: Number(tx.price_per_share),
          total_amount: amount,
          fees: Number(tx.fees) || 0,
          cumulative_shares: cumulativeShares,
          avg_cost: avgCost
        };
      }) || [];

      setTransactions(transactionsList);
      setCurrentView('transactions');
    } catch (error) {
      console.error('Error fetching transactions:', error);
      alert('Failed to fetch transactions');
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

  function getSortedData<T extends Record<string, any>>(data: T[]): T[] {
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

  function renderBreadcrumb() {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <button
          onClick={() => {
            setCurrentView('entities');
            setSelectedEntity(null);
            setSelectedShare(null);
          }}
          className={`${currentView === 'entities' ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Entities
        </button>

        {(currentView === 'shares' || currentView === 'transactions') && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => {
                setCurrentView('shares');
                setSelectedShare(null);
              }}
              className={`${currentView === 'shares' ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {selectedEntity?.name}
            </button>
          </>
        )}

        {currentView === 'transactions' && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-blue-600 font-semibold">{selectedShare?.ticker}</span>
          </>
        )}
      </div>
    );
  }

  function renderDateFilter() {
    return (
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => {
            if (currentView === 'shares' && selectedEntity) {
              fetchSharesForEntity(selectedEntity);
            } else if (currentView === 'transactions' && selectedShare) {
              fetchTransactionsForShare(selectedShare);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Apply
        </button>
      </div>
    );
  }

  function SortableHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    return (
      <th
        onClick={() => handleSort(field)}
        className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-1">
          <span>{children}</span>
          <ArrowUpDown className={`w-4 h-4 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
        </div>
      </th>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Detail Analysis</h1>
        <p className="text-gray-500 mt-1">Drill down to analyze shares by entity and view detailed transaction history</p>
      </div>

      <div className="flex items-center justify-between">
        {renderBreadcrumb()}
        {currentView !== 'entities' && renderDateFilter()}
      </div>

      {currentView === 'entities' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Select an Entity</h2>
                <p className="text-sm text-gray-500">Click on an entity to view their share details</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortableHeader field="name">Entity Name</SortableHeader>
                  <SortableHeader field="entity_id">CDS Account</SortableHeader>
                  <SortableHeader field="total_shares">Total Shares</SortableHeader>
                  <SortableHeader field="total_investment">Total Investment</SortableHeader>
                  <SortableHeader field="total_value">Current Value</SortableHeader>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gain/Loss</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedData(entities).map((entity) => {
                  const gainLoss = entity.total_value - entity.total_investment;
                  const gainLossPercent = entity.total_investment > 0 ? (gainLoss / entity.total_investment) * 100 : 0;

                  return (
                    <tr key={entity.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => fetchSharesForEntity(entity)}>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{entity.name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{entity.entity_id}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{entity.total_shares.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        Rs. {entity.total_investment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        Rs. {entity.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center space-x-1 ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {gainLoss >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          <span className="text-sm font-semibold">
                            Rs. {Math.abs(gainLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="ml-1">({gainLossPercent.toFixed(2)}%)</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center space-x-1">
                          <span>View Shares</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {entities.length === 0 && (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No entities found with active holdings</p>
            </div>
          )}
        </div>
      )}

      {currentView === 'shares' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setCurrentView('entities');
                    setSelectedEntity(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Shares for {selectedEntity?.name}</h2>
                  <p className="text-sm text-gray-500">Click on a share to view transaction details</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortableHeader field="ticker">Ticker</SortableHeader>
                  <SortableHeader field="name">Company Name</SortableHeader>
                  <SortableHeader field="total_shares">No. of shares</SortableHeader>
                  <SortableHeader field="sales_cost">Sales Cost</SortableHeader>
                  <SortableHeader field="avg_cost_buy">Av Cost (Buy)</SortableHeader>
                  <SortableHeader field="avg_cost_sell">Av Cost (Sell)</SortableHeader>
                  <SortableHeader field="avg_price">Av price</SortableHeader>
                  <SortableHeader field="cost_per_share">Cost per share</SortableHeader>
                  <SortableHeader field="sale_value">Sale Value</SortableHeader>
                  <SortableHeader field="purchase_value">Purchase Value</SortableHeader>
                  <SortableHeader field="total_cost">Total Cost</SortableHeader>
                  <SortableHeader field="current_price">Current Price</SortableHeader>
                  <SortableHeader field="current_value">Current Value</SortableHeader>
                  <SortableHeader field="gain_loss">Gain/Loss</SortableHeader>
                  <SortableHeader field="first_purchase">First Purchase</SortableHeader>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedData(shares).map((share) => (
                  <tr key={share.share_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => fetchTransactionsForShare(share)}>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">{share.ticker}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{share.name}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{share.total_shares.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.sales_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.avg_cost_buy.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.avg_cost_sell.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.avg_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.cost_per_share.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.sale_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.purchase_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {share.current_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      Rs. {share.current_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex flex-col ${share.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span className="text-sm font-semibold">
                          Rs. {share.gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs">({share.gain_loss_percent.toFixed(2)}%)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(share.first_purchase).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center space-x-1">
                        <span>View Txns</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shares.length === 0 && (
            <div className="p-12 text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No shares found for this entity</p>
            </div>
          )}
        </div>
      )}

      {currentView === 'transactions' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setCurrentView('shares');
                    setSelectedShare(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Transactions for {selectedShare?.ticker} - {selectedShare?.name}
                  </h2>
                  <p className="text-sm text-gray-500">Entity: {selectedEntity?.name}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortableHeader field="transaction_date">Date</SortableHeader>
                  <SortableHeader field="transaction_type">Type</SortableHeader>
                  <SortableHeader field="no_of_shares">No. of shares</SortableHeader>
                  <SortableHeader field="price_per_share">Price/Share</SortableHeader>
                  <SortableHeader field="total_amount">Total Amount</SortableHeader>
                  <SortableHeader field="fees">Fees</SortableHeader>
                  <SortableHeader field="cumulative_shares">Cumulative Shares</SortableHeader>
                  <SortableHeader field="avg_cost">Avg Cost</SortableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedData(transactions).map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{new Date(tx.transaction_date).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {tx.no_of_shares.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rs. {tx.price_per_share.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      Rs. {tx.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      Rs. {tx.fees.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">
                      {tx.cumulative_shares.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      Rs. {tx.avg_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transactions.length === 0 && (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No transactions found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
