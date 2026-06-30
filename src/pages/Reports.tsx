import { FileText, Calendar, Filter, PieChart, BarChart3, Printer, X, Download, TrendingUp, BookOpen, Layers, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ShareHolding {
  share_id: string;
  ticker: string;
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
    ticker: string;
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
  share_ticker: string;
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

interface DividendReportRow {
  entity_name: string;
  ticker: string;
  share_name: string;
  dividend_date: string;
  quantity: number;
  gross_per_share: number;
  wht_rate: number;
  net_per_share: number;
  total_gross: number;
  total_net: number;
  status: string;
  payment_method: string | null;
  bank_name: string | null;
}

interface ScripEntryReportRow {
  entity_name: string;
  ticker: string;
  share_name: string;
  entry_date: string;
  effective_date: string | null;
  no_of_shares: number;
  script_dividend_ratio: string | null;
  status: string;
  notes: string | null;
}

interface ShareAnalyticsReportRow {
  entity_name: string;
  ticker: string;
  share_name: string;
  share_cum_bal: number;
  purchase_cost: number;
  sale_value: number;
  av_cost: number;
  dividend: number;
  cum_surplus: number;
  market_value: number;
  cash_flow: number;
  total_surplus: number;
}

interface SectorWiseRow {
  sector: string;
  total_cost: number;
  market_value: number;
  dividends: number;
  total_returns: number;
  share_count: number;
}

interface ContributorRow {
  share_name: string;
  ticker: string;
  balance: number;
  total_cost: number;
  market_value: number;
  dividends: number;
  total_returns: number;
  aer: number;
}

type ReportType = 'share' | 'portfolio' | 'detailed' | 'cashbook' | 'dividends' | 'scrip' | 'analytics' | 'sector-wise' | 'contributors' | null;

export function Reports() {
  const { isAdmin, hasMenuAccess } = useAuth();
  const canSeeReport = (key: string) => isAdmin || hasMenuAccess(key);
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [shareData, setShareData] = useState<ShareHolding[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioHolding[]>([]);
  const [detailedData, setDetailedData] = useState<DetailedShareTransaction[]>([]);
  const [cashbookData, setCashbookData] = useState<CashbookReport | null>(null);
  const [dividendData, setDividendData] = useState<DividendReportRow[]>([]);
  const [scripData, setScripData] = useState<ScripEntryReportRow[]>([]);
  const [analyticsData, setAnalyticsData] = useState<ShareAnalyticsReportRow[]>([]);
  const [sectorWiseData, setSectorWiseData] = useState<SectorWiseRow[]>([]);
  const [contributorsData, setContributorsData] = useState<ContributorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedEntityName, setSelectedEntityName] = useState<string>('All Entities');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);

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

      let query = supabase
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
            share_name
          )
        `);

      if (fromDate) {
        query = query.gte('transaction_date', fromDate);
      }
      if (toDate) {
        query = query.lte('transaction_date', toDate);
      }

      const { data: transactions, error: txError } = await query;

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
        ticker: string;
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
            ticker: tx.shares.ticker,
            name: tx.shares.share_name,
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
          const currentPrice = latestPrices.get(data.ticker) || avgCost;
          const currentValue = data.total_shares * currentPrice;
          const gainLoss = currentValue - data.total_cost;
          const gainLossPercent = data.total_cost > 0 ? (gainLoss / data.total_cost) * 100 : 0;

          return {
            share_id: shareId,
            ticker: data.ticker,
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
        .sort((a, b) => a.ticker.localeCompare(b.ticker));

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

      let transactionsQuery = supabase
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
            ticker,
            share_name,
            sector
          )
        `)
        .order('transaction_date', { ascending: true });

      if (fromDate) {
        transactionsQuery = transactionsQuery.gte('transaction_date', fromDate);
      }
      if (toDate) {
        transactionsQuery = transactionsQuery.lte('transaction_date', toDate);
      }

      let dividendsQuery = supabase
        .from('dividends')
        .select('entity_id, share_id, payment_date, amount_net, amount_gross')
        .order('payment_date', { ascending: false });

      if (fromDate) {
        dividendsQuery = dividendsQuery.gte('payment_date', fromDate);
      }
      if (toDate) {
        dividendsQuery = dividendsQuery.lte('payment_date', toDate);
      }

      const [transactionsRes, dividendsRes, pricesRes, entitiesRes] = await Promise.all([
        transactionsQuery,
        dividendsQuery,
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
          ticker: string;
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
            ticker: tx.shares.ticker,
            name: tx.shares.share_name,
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
                ticker: share.ticker,
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

      let transactionsQuery = supabase
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
            ticker,
            share_name
          )
        `)
        .order('transaction_date', { ascending: true });

      if (fromDate) {
        transactionsQuery = transactionsQuery.gte('transaction_date', fromDate);
      }
      if (toDate) {
        transactionsQuery = transactionsQuery.lte('transaction_date', toDate);
      }

      let dividendsQuery = supabase
        .from('dividends')
        .select('entity_id, share_id, payment_date, amount_net')
        .order('payment_date', { ascending: true });

      if (fromDate) {
        dividendsQuery = dividendsQuery.gte('payment_date', fromDate);
      }
      if (toDate) {
        dividendsQuery = dividendsQuery.lte('payment_date', toDate);
      }

      const [transactionsRes, dividendsRes, pricesRes, entitiesRes] = await Promise.all([
        transactionsQuery,
        dividendsQuery,
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
          share_ticker: tx.shares.ticker,
          share_name: tx.shares.share_name,
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

      if (fromDate) {
        query = query.gte('date', fromDate);
      }
      if (toDate) {
        query = query.lte('date', toDate);
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
        total_out: totalOut,
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

  async function generateDividendsReport() {
    try {
      setLoading(true);
      let query = supabase
        .from('dividends')
        .select(`
          entity_id, share_id, dividend_date, quantity,
          gross_dividend_per_share, withholding_tax_rate, net_dividend_per_share,
          amount_gross, amount_net, status, payment_method, bank_name,
          entities ( name ),
          shares ( ticker, share_name )
        `)
        .order('dividend_date', { ascending: false });

      if (selectedEntity !== 'all') query = query.eq('entity_id', selectedEntity);
      if (fromDate) query = query.gte('dividend_date', fromDate);
      if (toDate) query = query.lte('dividend_date', toDate);

      const { data, error } = await query;
      if (error) throw error;

      const rows: DividendReportRow[] = (data || []).map((d: any) => ({
        entity_name: d.entities?.name || '',
        ticker: d.shares?.ticker || '',
        share_name: d.shares?.share_name || '',
        dividend_date: d.dividend_date,
        quantity: Number(d.quantity),
        gross_per_share: Number(d.gross_dividend_per_share),
        wht_rate: Number(d.withholding_tax_rate),
        net_per_share: Number(d.net_dividend_per_share),
        total_gross: Number(d.amount_gross),
        total_net: Number(d.amount_net),
        status: d.status || '',
        payment_method: d.payment_method,
        bank_name: d.bank_name,
      }));

      setDividendData(rows);
      setActiveReport('dividends');
    } catch (err) {
      console.error(err);
      alert('Failed to generate dividends report');
    } finally {
      setLoading(false);
    }
  }

  async function generateScripReport() {
    try {
      setLoading(true);
      let query = supabase
        .from('scrip_entries')
        .select(`
          entity_id, share_id, entry_date, effective_date,
          no_of_shares, script_dividend_ratio, status, notes,
          entities ( name ),
          shares ( ticker, share_name )
        `)
        .order('entry_date', { ascending: false });

      if (selectedEntity !== 'all') query = query.eq('entity_id', selectedEntity);
      if (fromDate) query = query.gte('entry_date', fromDate);
      if (toDate) query = query.lte('entry_date', toDate);

      const { data, error } = await query;
      if (error) throw error;

      const rows: ScripEntryReportRow[] = (data || []).map((s: any) => ({
        entity_name: s.entities?.name || '',
        ticker: s.shares?.ticker || '',
        share_name: s.shares?.share_name || '',
        entry_date: s.entry_date,
        effective_date: s.effective_date,
        no_of_shares: Number(s.no_of_shares),
        script_dividend_ratio: s.script_dividend_ratio,
        status: s.status || '',
        notes: s.notes,
      }));

      setScripData(rows);
      setActiveReport('scrip');
    } catch (err) {
      console.error(err);
      alert('Failed to generate scrip entries report');
    } finally {
      setLoading(false);
    }
  }

  async function generateAnalyticsReport() {
    try {
      setLoading(true);

      const [txRes, divRes, priceRes, obRes] = await Promise.all([
        supabase.from('transactions').select(`
          entity_id, share_id, transaction_type, no_of_shares, total_amount,
          entities ( name ), shares ( ticker, share_name )
        `).order('transaction_date', { ascending: true }),
        supabase.from('dividends').select('entity_id, share_id, amount_net'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('entity_share_opening_balances').select('entity_id, share_id, opening_balance, opening_cost'),
      ]);

      if (txRes.error) throw txRes.error;

      const latestPrices = new Map<string, number>();
      priceRes.data?.forEach((p: any) => { if (!latestPrices.has(p.share_id)) latestPrices.set(p.share_id, p.share_price); });

      const divMap = new Map<string, number>();
      divRes.data?.forEach((d: any) => {
        const k = `${d.entity_id}||${d.share_id}`;
        divMap.set(k, (divMap.get(k) || 0) + Number(d.amount_net));
      });

      type Acc = { entity_name: string; ticker: string; share_name: string; share_id: string; bal: number; cost: number; purchase_cost: number; sale_value: number; };
      const map = new Map<string, Acc>();

      obRes.data?.forEach((ob: any) => {
        const k = `${ob.entity_id}||${ob.share_id}`;
        if (!map.has(k)) map.set(k, { entity_name: '', ticker: '', share_name: '', share_id: ob.share_id, bal: 0, cost: 0, purchase_cost: 0, sale_value: 0 });
        const r = map.get(k)!;
        r.bal += Number(ob.opening_balance || 0);
        r.cost += Number(ob.opening_cost || 0);
        r.purchase_cost += Number(ob.opening_cost || 0);
      });

      txRes.data?.forEach((tx: any) => {
        if (!tx.entities || !tx.shares) return;
        const k = `${tx.entity_id}||${tx.share_id}`;
        if (!map.has(k)) map.set(k, { entity_name: tx.entities.name, ticker: tx.shares.ticker, share_name: tx.shares.share_name, share_id: tx.share_id, bal: 0, cost: 0, purchase_cost: 0, sale_value: 0 });
        const r = map.get(k)!;
        if (!r.entity_name) { r.entity_name = tx.entities.name; r.ticker = tx.shares.ticker; r.share_name = tx.shares.share_name; }
        const shares = Number(tx.no_of_shares);
        const amt = Number(tx.total_amount);
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        if (isBuy) { r.bal += shares; r.cost += amt; r.purchase_cost += amt; }
        else {
          const prevBal = r.bal;
          r.bal -= shares;
          r.cost -= prevBal > 0 ? (r.cost / prevBal) * shares : 0;
          r.sale_value += amt;
        }
      });

      const rows: ShareAnalyticsReportRow[] = [];
      map.forEach((r, k) => {
        const dividend = divMap.get(k) || 0;
        const marketPrice = latestPrices.get(r.share_id) || 0;
        const market_value = r.bal * marketPrice;
        const cum_surplus = r.sale_value + dividend - r.purchase_cost;
        const cash_flow = r.sale_value - r.purchase_cost;
        rows.push({
          entity_name: r.entity_name,
          ticker: r.ticker,
          share_name: r.share_name,
          share_cum_bal: r.bal,
          purchase_cost: r.purchase_cost,
          sale_value: r.sale_value,
          av_cost: r.bal > 0 ? r.cost / r.bal : 0,
          dividend,
          cum_surplus,
          market_value,
          cash_flow,
          total_surplus: cum_surplus + market_value,
        });
      });

      setAnalyticsData(rows.filter(r => r.entity_name));
      setActiveReport('analytics');
    } catch (err) {
      console.error(err);
      alert('Failed to generate analytics report');
    } finally {
      setLoading(false);
    }
  }

  async function generateSectorWiseReport() {
    try {
      setLoading(true);

      const [txRes, divRes, priceRes, obRes, sharesRes] = await Promise.all([
        supabase.from('transactions')
          .select('entity_id, share_id, transaction_type, no_of_shares, total_amount, brokerage_fee_rate')
          .in('approval_status', ['MANUAL_APPROVED'])
          .order('transaction_date', { ascending: true }),
        supabase.from('dividends').select('share_id, amount_net'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('entity_share_opening_balances').select('share_id, opening_balance, opening_cost'),
        supabase.from('shares').select('id, ticker, share_name, sector, sector_types(sector_name)'),
      ]);

      if (txRes.error) throw txRes.error;
      if (sharesRes.error) throw sharesRes.error;

      const latestPrices = new Map<string, number>();
      priceRes.data?.forEach((p: any) => { if (!latestPrices.has(p.share_id)) latestPrices.set(p.share_id, p.share_price); });

      const shareInfo = new Map<string, { ticker: string; name: string; sector: string }>();
      sharesRes.data?.forEach((s: any) => {
        const sector = (s.sector_types as { sector_name: string } | null)?.sector_name || s.sector || 'Other';
        shareInfo.set(s.id, { ticker: s.ticker, name: s.share_name, sector });
      });

      const divMap = new Map<string, number>();
      divRes.data?.forEach((d: any) => {
        divMap.set(d.share_id, (divMap.get(d.share_id) || 0) + Number(d.amount_net));
      });

      type HoldAcc = { held: number; cost: number; totalCostAll: number; saleProceeds: number; feeRate: number };
      const holdMap = new Map<string, HoldAcc>();

      obRes.data?.forEach((ob: any) => {
        if (!holdMap.has(ob.share_id)) holdMap.set(ob.share_id, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0, feeRate: 0 });
        const h = holdMap.get(ob.share_id)!;
        h.held += Number(ob.opening_balance || 0);
        h.cost += Number(ob.opening_cost || 0);
        h.totalCostAll += Number(ob.opening_cost || 0);
      });

      txRes.data?.forEach((tx: any) => {
        if (!holdMap.has(tx.share_id)) holdMap.set(tx.share_id, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0, feeRate: 0 });
        const h = holdMap.get(tx.share_id)!;
        const shares_qty = Number(tx.no_of_shares);
        const gross = Number(tx.total_amount);
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        if (tx.brokerage_fee_rate != null) h.feeRate = Number(tx.brokerage_fee_rate);
        if (isBuy) {
          h.held += shares_qty; h.cost += gross; h.totalCostAll += gross;
        } else {
          const avgCPS = h.held > 0 ? h.cost / h.held : 0;
          h.held = Math.max(0, h.held - shares_qty);
          h.cost = Math.max(0, h.cost - avgCPS * shares_qty);
          h.saleProceeds += gross;
        }
      });

      const sectorMap = new Map<string, SectorWiseRow>();
      holdMap.forEach((h, shareId) => {
        if (h.held <= 0) return;
        const info = shareInfo.get(shareId);
        if (!info) return;
        const price = latestPrices.get(shareId) || 0;
        const feeRate = h.feeRate / 100;
        const mv = h.held * price * (1 - feeRate);
        const divs = divMap.get(shareId) || 0;
        const totalReturns = (mv + h.saleProceeds + divs) - h.totalCostAll;

        const sector = info.sector;
        if (!sectorMap.has(sector)) {
          sectorMap.set(sector, { sector, total_cost: 0, market_value: 0, dividends: 0, total_returns: 0, share_count: 0 });
        }
        const sr = sectorMap.get(sector)!;
        sr.total_cost += h.cost;
        sr.market_value += mv;
        sr.dividends += divs;
        sr.total_returns += totalReturns;
        sr.share_count += 1;
      });

      const rows = Array.from(sectorMap.values()).sort((a, b) => b.market_value - a.market_value);
      setSectorWiseData(rows);
      setActiveReport('sector-wise');
    } catch (err) {
      console.error(err);
      alert('Failed to generate sector-wise report');
    } finally {
      setLoading(false);
    }
  }

  async function generateContributorsReport() {
    try {
      setLoading(true);

      const [txRes, divRes, priceRes, obRes, sharesRes] = await Promise.all([
        supabase.from('transactions')
          .select('share_id, transaction_type, no_of_shares, total_amount, brokerage_fee_rate')
          .in('approval_status', ['MANUAL_APPROVED'])
          .order('transaction_date', { ascending: true }),
        supabase.from('dividends').select('share_id, amount_net'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('entity_share_opening_balances').select('share_id, opening_balance, opening_cost'),
        supabase.from('shares').select('id, ticker, share_name'),
      ]);

      if (txRes.error) throw txRes.error;
      if (sharesRes.error) throw sharesRes.error;

      const latestPrices = new Map<string, number>();
      priceRes.data?.forEach((p: any) => { if (!latestPrices.has(p.share_id)) latestPrices.set(p.share_id, p.share_price); });

      const shareInfo = new Map<string, { ticker: string; name: string }>();
      sharesRes.data?.forEach((s: any) => { shareInfo.set(s.id, { ticker: s.ticker, name: s.share_name }); });

      const divMap = new Map<string, number>();
      divRes.data?.forEach((d: any) => { divMap.set(d.share_id, (divMap.get(d.share_id) || 0) + Number(d.amount_net)); });

      type HoldAcc = { held: number; cost: number; totalCostAll: number; saleProceeds: number; feeRate: number };
      const holdMap = new Map<string, HoldAcc>();

      obRes.data?.forEach((ob: any) => {
        if (!holdMap.has(ob.share_id)) holdMap.set(ob.share_id, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0, feeRate: 0 });
        const h = holdMap.get(ob.share_id)!;
        h.held += Number(ob.opening_balance || 0);
        h.cost += Number(ob.opening_cost || 0);
        h.totalCostAll += Number(ob.opening_cost || 0);
      });

      txRes.data?.forEach((tx: any) => {
        if (!holdMap.has(tx.share_id)) holdMap.set(tx.share_id, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0, feeRate: 0 });
        const h = holdMap.get(tx.share_id)!;
        const shares_qty = Number(tx.no_of_shares);
        const gross = Number(tx.total_amount);
        const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'Buy';
        if (tx.brokerage_fee_rate != null) h.feeRate = Number(tx.brokerage_fee_rate);
        if (isBuy) {
          h.held += shares_qty; h.cost += gross; h.totalCostAll += gross;
        } else {
          const avgCPS = h.held > 0 ? h.cost / h.held : 0;
          h.held = Math.max(0, h.held - shares_qty);
          h.cost = Math.max(0, h.cost - avgCPS * shares_qty);
          h.saleProceeds += gross;
        }
      });

      const rows: ContributorRow[] = [];
      holdMap.forEach((h, shareId) => {
        if (h.held <= 0) return;
        const info = shareInfo.get(shareId);
        if (!info) return;
        const price = latestPrices.get(shareId) || 0;
        const feeRate = h.feeRate / 100;
        const mv = h.held * price * (1 - feeRate);
        const divs = divMap.get(shareId) || 0;
        const totalReturns = (mv + h.saleProceeds + divs) - h.totalCostAll;
        const aer = h.cost > 0 ? ((mv - h.cost + divs) / h.cost) * 100 : 0;
        rows.push({ share_name: info.name, ticker: info.ticker, balance: h.held, total_cost: h.cost, market_value: mv, dividends: divs, total_returns: totalReturns, aer });
      });

      rows.sort((a, b) => a.share_name.localeCompare(b.share_name));
      setContributorsData(rows);
      setActiveReport('contributors');
    } catch (err) {
      console.error(err);
      alert('Failed to generate contributors report');
    } finally {
      setLoading(false);
    }
  }

  function exportToExcel(reportType: ReportType) {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = 'report.csv';

    if (reportType === 'dividends') {
      filename = 'dividends_report.csv';
      headers = ['Entity', 'Ticker', 'Share Name', 'Dividend Date', 'Quantity', 'Gross/Share', 'WHT%', 'Net/Share', 'Total Gross', 'Total Net', 'Status', 'Payment Method', 'Bank'];
      rows = dividendData.map(d => [d.entity_name, d.ticker, d.share_name, d.dividend_date, d.quantity, d.gross_per_share, d.wht_rate, d.net_per_share, d.total_gross, d.total_net, d.status, d.payment_method || '', d.bank_name || '']);
    } else if (reportType === 'scrip') {
      filename = 'scrip_entries_report.csv';
      headers = ['Entity', 'Ticker', 'Share Name', 'Entry Date', 'Effective Date', 'No. of Shares', 'Script Ratio', 'Status', 'Notes'];
      rows = scripData.map(s => [s.entity_name, s.ticker, s.share_name, s.entry_date, s.effective_date || '', s.no_of_shares, s.script_dividend_ratio || '', s.status, s.notes || '']);
    } else if (reportType === 'analytics') {
      filename = 'share_analytics_report.csv';
      headers = ['Entity', 'Ticker', 'Share Name', 'Share Balance', 'Purchase Cost', 'Sale Value', 'Avg Cost', 'Dividend', 'Cum Surplus', 'Market Value', 'Cash Flow', 'Total Surplus'];
      rows = analyticsData.map(a => [a.entity_name, a.ticker, a.share_name, a.share_cum_bal, a.purchase_cost.toFixed(2), a.sale_value.toFixed(2), a.av_cost.toFixed(4), a.dividend.toFixed(2), (a.cum_surplus + a.market_value).toFixed(2), a.market_value.toFixed(2), a.cash_flow.toFixed(2), a.total_surplus.toFixed(2)]);
    } else if (reportType === 'share') {
      filename = 'share_holdings_report.csv';
      headers = ['Symbol', 'Company', 'Shares', 'Avg Cost', 'Total Cost', 'Current Price', 'Current Value', 'Gain/Loss', '%'];
      rows = shareData.map(s => [s.ticker, s.name, s.total_shares, s.avg_cost.toFixed(2), s.total_cost.toFixed(2), s.current_price.toFixed(2), s.current_value.toFixed(2), s.gain_loss.toFixed(2), s.gain_loss_percent.toFixed(2)]);
    } else if (reportType === 'portfolio') {
      filename = 'portfolio_holdings_report.csv';
      headers = ['Entity', 'Sector', 'Share', 'Balance', 'Cost', 'Cost/Share', 'Mkt Price', 'Mkt Value', 'Dividends', 'Total Returns', 'AER%'];
      portfolioData.forEach(entity => {
        entity.holdings.forEach(h => {
          rows.push([entity.entity_name, h.sector, h.ticker, h.balance, h.cost.toFixed(2), h.cost_per_share.toFixed(4), h.market_price_per_share.toFixed(2), h.market_value_net.toFixed(2), h.dividends.toFixed(2), h.total_returns.toFixed(2), h.aer.toFixed(2)]);
        });
      });
    }

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
              onClick={generateShareReport}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => exportToExcel('share')}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-5 h-5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Holdings Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            {fromDate && <p className="text-sm text-gray-500 mt-1">Date Range: {new Date(fromDate).toLocaleDateString()} - {new Date(toDate).toLocaleDateString()}</p>}
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
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{share.ticker}</td>
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
              onClick={generateDetailedShareReport}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-5 h-5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg border border-gray-200 overflow-x-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Detailed Share Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            {fromDate && <p className="text-sm text-gray-500 mt-1">Date Range: {new Date(fromDate).toLocaleDateString()} - {new Date(toDate).toLocaleDateString()}</p>}
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
                  <td className="px-2 py-2 text-xs font-medium text-gray-900">{row.share_ticker}</td>
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
              onClick={generateCashbookReport}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-5 h-5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Cash Book</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            <p className="text-sm text-gray-500 mt-1">Entity: {selectedEntityName}</p>
            {fromDate && <p className="text-sm text-gray-500 mt-1">Date Range: {new Date(fromDate).toLocaleDateString()} - {new Date(toDate).toLocaleDateString()}</p>}
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

  if (activeReport === 'dividends') {
    const totalGross = dividendData.reduce((s, d) => s + d.total_gross, 0);
    const totalNet = dividendData.reduce((s, d) => s + d.total_net, 0);
    return (
      <div className="p-8">
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
        <div className="no-print mb-6 flex items-center justify-between">
          <button onClick={closeReport} className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" /><span>Close</span>
          </button>
          <div className="flex items-center space-x-3">
            <button onClick={() => exportToExcel('dividends')} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Download className="w-4 h-4" /><span>Export Excel</span>
            </button>
            <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Printer className="w-5 h-5" /><span>Print</span>
            </button>
          </div>
        </div>
        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dividends Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            {fromDate && <p className="text-sm text-gray-500 mt-1">Date Range: {new Date(fromDate).toLocaleDateString()} - {new Date(toDate).toLocaleDateString()}</p>}
          </div>
          <table className="w-full mb-6 text-sm">
            <thead className="bg-gray-50 border-b-2 border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Entity</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Ticker</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Share</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Date</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Quantity</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Gross/Share</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">WHT%</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Net/Share</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Total Gross</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Total Net</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Status</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dividendData.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-900">{d.entity_name}</td>
                  <td className="px-3 py-2 text-xs font-bold text-gray-900">{d.ticker}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{d.share_name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{new Date(d.dividend_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-900">{d.quantity.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-900">{d.gross_per_share.toFixed(4)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-700">{d.wht_rate}%</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-900">{d.net_per_share.toFixed(4)}</td>
                  <td className="px-3 py-2 text-xs text-right font-medium text-gray-900">{d.total_gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-xs text-right font-semibold text-blue-700">{d.total_net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{d.status}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{d.payment_method || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-700 bg-gray-50">
              <tr>
                <td colSpan={8} className="px-3 py-3 text-sm font-bold text-gray-900 text-right">Totals:</td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-3 text-sm font-bold text-blue-700 text-right">{totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  if (activeReport === 'scrip') {
    const totalShares = scripData.reduce((s, r) => s + r.no_of_shares, 0);
    return (
      <div className="p-8">
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
        <div className="no-print mb-6 flex items-center justify-between">
          <button onClick={closeReport} className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" /><span>Close</span>
          </button>
          <div className="flex items-center space-x-3">
            <button onClick={() => exportToExcel('scrip')} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Download className="w-4 h-4" /><span>Export Excel</span>
            </button>
            <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Printer className="w-5 h-5" /><span>Print</span>
            </button>
          </div>
        </div>
        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Scrip Entries Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            {fromDate && <p className="text-sm text-gray-500 mt-1">Date Range: {new Date(fromDate).toLocaleDateString()} - {new Date(toDate).toLocaleDateString()}</p>}
          </div>
          <table className="w-full mb-6 text-sm">
            <thead className="bg-gray-50 border-b-2 border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Entity</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Ticker</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Share</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Entry Date</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Effective Date</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">No. of Shares</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Script Ratio</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Status</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scripData.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-900">{s.entity_name}</td>
                  <td className="px-3 py-2 text-xs font-bold text-gray-900">{s.ticker}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{s.share_name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{new Date(s.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{s.effective_date ? new Date(s.effective_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                  <td className="px-3 py-2 text-xs text-right font-semibold text-gray-900">{s.no_of_shares.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{s.script_dividend_ratio || '-'}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'RECEIVED' ? 'bg-green-100 text-green-700' : s.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{s.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-700 bg-gray-50">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-sm font-bold text-gray-900 text-right">Total Shares:</td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{totalShares.toLocaleString()}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  if (activeReport === 'analytics') {
    const totPurchase = analyticsData.reduce((s, r) => s + r.purchase_cost, 0);
    const totSale = analyticsData.reduce((s, r) => s + r.sale_value, 0);
    const totDiv = analyticsData.reduce((s, r) => s + r.dividend, 0);
    const totMV = analyticsData.reduce((s, r) => s + r.market_value, 0);
    const totSurplus = analyticsData.reduce((s, r) => s + r.total_surplus, 0);
    const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
      <div className="p-8">
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
        <div className="no-print mb-6 flex items-center justify-between">
          <button onClick={closeReport} className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" /><span>Close</span>
          </button>
          <div className="flex items-center space-x-3">
            <button onClick={() => exportToExcel('analytics')} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Download className="w-4 h-4" /><span>Export Excel</span>
            </button>
            <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Printer className="w-5 h-5" /><span>Print</span>
            </button>
          </div>
        </div>
        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Analytics Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Purchase Cost', value: `Rs. ${fmt2(totPurchase)}`, color: 'text-gray-900' },
              { label: 'Total Sale Value', value: `Rs. ${fmt2(totSale)}`, color: 'text-gray-900' },
              { label: 'Total Dividends', value: `Rs. ${fmt2(totDiv)}`, color: 'text-yellow-700' },
              { label: 'Total Market Value', value: `Rs. ${fmt2(totMV)}`, color: 'text-blue-700' },
            ].map(card => (
              <div key={card.label} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
          <table className="w-full mb-6 text-sm">
            <thead className="bg-gray-50 border-b-2 border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Entity</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Ticker</th>
                <th className="px-3 py-2 text-left font-bold text-gray-900">Share</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Balance</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Purchase Cost</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Sale Value</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Avg Cost</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Dividend</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Cum Surplus</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Mkt Value</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Cash Flow</th>
                <th className="px-3 py-2 text-right font-bold text-gray-900">Total Surplus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analyticsData.map((a, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-900">{a.entity_name}</td>
                  <td className="px-3 py-2 text-xs font-bold text-gray-900">{a.ticker}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{a.share_name}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-900">{a.share_cum_bal.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-900">{fmt2(a.purchase_cost)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-900">{fmt2(a.sale_value)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-700">{a.av_cost.toFixed(4)}</td>
                  <td className="px-3 py-2 text-xs text-right text-yellow-700">{fmt2(a.dividend)}</td>
                  <td className={`px-3 py-2 text-xs text-right font-medium ${(a.cum_surplus + a.market_value) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt2(a.cum_surplus + a.market_value)}</td>
                  <td className="px-3 py-2 text-xs text-right text-blue-700">{fmt2(a.market_value)}</td>
                  <td className={`px-3 py-2 text-xs text-right ${a.cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt2(a.cash_flow)}</td>
                  <td className={`px-3 py-2 text-xs text-right font-semibold ${a.total_surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt2(a.total_surplus)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-700 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-3 py-3 text-sm font-bold text-gray-900 text-right">Totals:</td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{fmt2(totPurchase)}</td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{fmt2(totSale)}</td>
                <td />
                <td className="px-3 py-3 text-sm font-bold text-yellow-700 text-right">{fmt2(totDiv)}</td>
                <td className={`px-3 py-3 text-sm font-bold text-right ${analyticsData.reduce((s, r) => s + r.cum_surplus + r.market_value, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt2(analyticsData.reduce((s, r) => s + r.cum_surplus + r.market_value, 0))}</td>
                <td className="px-3 py-3 text-sm font-bold text-blue-700 text-right">{fmt2(totMV)}</td>
                <td />
                <td className={`px-3 py-3 text-sm font-bold text-right ${totSurplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt2(totSurplus)}</td>
              </tr>
            </tfoot>
          </table>
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
              onClick={generatePortfolioReport}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => exportToExcel('portfolio')}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-5 h-5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio Holdings Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            {fromDate && <p className="text-sm text-gray-500 mt-1">Date Range: {new Date(fromDate).toLocaleDateString()} - {new Date(toDate).toLocaleDateString()}</p>}
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
                      <tr key={`${entity.entity_id}-${holding.ticker}`} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-xs text-gray-900">{holding.sector}</td>
                        <td className="px-2 py-2 text-xs font-bold text-gray-900">{holding.ticker}</td>
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

  if (activeReport === 'sector-wise') {
    const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totCost = sectorWiseData.reduce((s, r) => s + r.total_cost, 0);
    const totMV = sectorWiseData.reduce((s, r) => s + r.market_value, 0);
    const totDiv = sectorWiseData.reduce((s, r) => s + r.dividends, 0);
    const totReturns = sectorWiseData.reduce((s, r) => s + r.total_returns, 0);
    return (
      <div className="p-8">
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
        <div className="no-print mb-6 flex items-center justify-between">
          <button onClick={closeReport} className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" /><span>Close</span>
          </button>
          <div className="flex items-center space-x-3">
            <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Printer className="w-5 h-5" /><span>Print</span>
            </button>
          </div>
        </div>
        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sector-wise Report</h1>
            <p className="text-gray-600">Returns, Dividends &amp; Market Value by Sector</p>
            <p className="text-sm text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Cost', value: fmt2(totCost), color: 'text-gray-900' },
              { label: 'Total Market Value', value: fmt2(totMV), color: 'text-blue-700' },
              { label: 'Total Dividends', value: fmt2(totDiv), color: 'text-green-700' },
              { label: 'Total Returns', value: fmt2(totReturns), color: totReturns >= 0 ? 'text-green-700' : 'text-red-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>Rs. {value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Sector</th>
                  <th className="px-4 py-3 text-right font-bold">Shares</th>
                  <th className="px-4 py-3 text-right font-bold">Total Cost (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">Market Value (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">Dividends (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">Total Returns (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">MV % of Portfolio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sectorWiseData.map((row, i) => (
                  <tr key={row.sector} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.sector}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.share_count}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmt2(row.total_cost)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmt2(row.market_value)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt2(row.dividends)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.total_returns >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt2(row.total_returns)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{totMV > 0 ? ((row.market_value / totMV) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-800 bg-gray-100">
                <tr>
                  <td className="px-4 py-3 font-bold text-gray-900">Grand Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{sectorWiseData.reduce((s, r) => s + r.share_count, 0)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt2(totCost)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt2(totMV)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{fmt2(totDiv)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${totReturns >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt2(totReturns)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-8">
            <h3 className="text-base font-bold text-gray-900 mb-4">Sector Allocation</h3>
            <div className="space-y-3">
              {sectorWiseData.map(row => (
                <div key={row.sector} className="flex items-center gap-4">
                  <div className="w-36 text-sm font-medium text-gray-700 truncate">{row.sector}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-5 bg-blue-600 rounded-full"
                      style={{ width: `${totMV > 0 ? (row.market_value / totMV) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-14 text-right text-sm font-semibold text-gray-900">
                    {totMV > 0 ? ((row.market_value / totMV) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeReport === 'contributors') {
    const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totCost = contributorsData.reduce((s, r) => s + r.total_cost, 0);
    const totMV = contributorsData.reduce((s, r) => s + r.market_value, 0);
    const totDiv = contributorsData.reduce((s, r) => s + r.dividends, 0);
    const totReturns = contributorsData.reduce((s, r) => s + r.total_returns, 0);
    return (
      <div className="p-8">
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
        <div className="no-print mb-6 flex items-center justify-between">
          <button onClick={closeReport} className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" /><span>Close</span>
          </button>
          <div className="flex items-center space-x-3">
            <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Printer className="w-5 h-5" /><span>Print</span>
            </button>
          </div>
        </div>
        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Contributors by Share</h1>
            <p className="text-gray-600">Market Value, Dividends &amp; Returns per Share (Ascending by Share Name)</p>
            <p className="text-sm text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Cost', value: fmt2(totCost), color: 'text-gray-900' },
              { label: 'Total Market Value', value: fmt2(totMV), color: 'text-blue-700' },
              { label: 'Total Dividends', value: fmt2(totDiv), color: 'text-green-700' },
              { label: 'Total Returns', value: fmt2(totReturns), color: totReturns >= 0 ? 'text-green-700' : 'text-red-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>Rs. {value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">#</th>
                  <th className="px-4 py-3 text-left font-bold">Share Name</th>
                  <th className="px-4 py-3 text-left font-bold">Ticker</th>
                  <th className="px-4 py-3 text-right font-bold">Balance</th>
                  <th className="px-4 py-3 text-right font-bold">Total Cost (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">Market Value (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">Dividends (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">Total Returns (Rs.)</th>
                  <th className="px-4 py-3 text-right font-bold">AER %</th>
                  <th className="px-4 py-3 text-right font-bold">MV % of Portfolio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contributorsData.map((row, i) => (
                  <tr key={row.ticker} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.share_name}</td>
                    <td className="px-4 py-3 text-blue-700 font-bold">{row.ticker}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.balance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmt2(row.total_cost)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmt2(row.market_value)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{row.dividends > 0 ? fmt2(row.dividends) : '-'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.total_returns >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt2(row.total_returns)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.aer >= 0 ? 'text-green-700' : 'text-red-600'}`}>{row.aer.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{totMV > 0 ? ((row.market_value / totMV) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-800 bg-gray-100">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-bold text-gray-900 text-right">Grand Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt2(totCost)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt2(totMV)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{fmt2(totDiv)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${totReturns >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt2(totReturns)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
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
        {canSeeReport('reports.share-holdings') && (
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
        )}

        {canSeeReport('reports.portfolio') && (
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
        )}

        {canSeeReport('reports.cashbook') && (
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
        )}

        {canSeeReport('reports.analytics') && (
        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Share Analytics Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              Full portfolio analytics: purchase cost, sale value, dividends, market value, and surplus per entity and share
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">Updated: Today</div>
              <button
                onClick={generateAnalyticsReport}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
        )}

        {canSeeReport('reports.dividends') && (
        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-teal-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Dividends Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              All dividend records with gross/net amounts, WHT rates, payment status and bank details
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">Select Entity</label>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedEntity(value);
                  setSelectedEntityName(value === 'all' ? 'All Entities' : entities.find(ent => ent.id === value)?.name || 'Unknown');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Entities</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">Updated: Today</div>
              <button
                onClick={generateDividendsReport}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
        )}

        {canSeeReport('reports.scrip') && (
        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Scrip Entries Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              All scrip dividend entries with ratios, effective dates, and status tracking
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">Select Entity</label>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedEntity(value);
                  setSelectedEntityName(value === 'all' ? 'All Entities' : entities.find(ent => ent.id === value)?.name || 'Unknown');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Entities</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">Updated: Today</div>
              <button
                onClick={generateScripReport}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
        )}

        {canSeeReport('reports.sector-wise') && (
        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Layers className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sector-wise Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              Aggregated returns, dividends, and market value grouped by industry sector
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">Updated: Today</div>
              <button
                onClick={generateSectorWiseReport}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
        )}

        {canSeeReport('reports.contributors') && (
        <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-rose-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Real-time
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Contributors by Share</h3>
            <p className="text-sm text-gray-500 mb-4">
              All held shares sorted alphabetically by name with market value, dividends, returns and AER
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">Updated: Today</div>
              <button
                onClick={generateContributorsReport}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
        )}
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
